// Operaciones del módulo Boletas: validar, guardar, pagos, anulación y enlace con las causas.
import { ahoraISO, db } from '../../db/basedatos'
import type { Boleta, Cliente, Pago } from '../../db/tipos'
import { hoyISO } from '../../utilidades/formato'
import { limpiarRut, revisarRut } from '../../utilidades/rut'
import { normalizar } from '../../utilidades/texto'
import { calcularMontos, totalPagado } from './calculos'

export type DatosBoleta = Omit<Boleta, 'id' | 'creado' | 'actualizado' | 'ejemplo'>
export type ErroresBoleta = Partial<Record<keyof DatosBoleta, string>>

/** Revisa el formulario y recalcula retención, líquido y monto a cobrar */
export function validarBoleta(d: DatosBoleta): { errores: ErroresBoleta; datos: DatosBoleta } {
  const errores: ErroresBoleta = {}
  if (!Number.isInteger(d.numero) || d.numero <= 0) errores.numero = 'Escriba el número de la boleta.'
  if (!d.fechaEmision) errores.fechaEmision = 'Indique la fecha de emisión.'
  else if (d.fechaEmision > hoyISO()) errores.fechaEmision = 'La fecha de emisión no puede ser posterior a hoy.'
  if (!Number.isFinite(d.bruto) || d.bruto <= 0) errores.bruto = 'Escriba el monto bruto de los honorarios.'
  if (!Number.isFinite(d.porcentajeRetencion) || d.porcentajeRetencion < 0 || d.porcentajeRetencion > 50) {
    errores.porcentajeRetencion = 'Escriba un porcentaje entre 0 y 50.'
  }
  const rut = revisarRut(d.rutCliente)
  if (rut.error) errores.rutCliente = rut.error
  if (!d.clienteId && !d.nombreCliente?.trim()) errores.clienteId = 'Elija o escriba el cliente.'
  const montos = calcularMontos(Math.round(d.bruto || 0), d.porcentajeRetencion || 0, d.pagaRetencion)
  return {
    errores,
    datos: {
      ...d,
      bruto: Math.round(d.bruto || 0),
      ...montos,
      rutCliente: rut.valor,
      nombreCliente: d.nombreCliente?.trim() || undefined,
      glosa: d.glosa?.trim() || undefined,
      nota: d.nota?.trim() || undefined,
      fechaAnulacion: d.estado === 'Anulada' ? d.fechaAnulacion || hoyISO() : undefined,
    },
  }
}

/** Busca otra boleta con el mismo número */
export async function boletaPorNumero(numero: number, excluirId?: number): Promise<Boleta | undefined> {
  const b = await db.boletas.where('numero').equals(numero).first()
  return b && b.id !== excluirId ? b : undefined
}

/** Deja las causas apuntando a esta boleta (y suelta las que ya no están asociadas) */
async function sincronizarCausas(boletaId: number, causaIds: number[]): Promise<void> {
  const ahora = ahoraISO()
  await db.causas.where('boletaId').equals(boletaId).and((c) => !causaIds.includes(c.id!)).modify({ boletaId: undefined, actualizado: ahora })
  if (causaIds.length) await db.causas.where('id').anyOf(causaIds).modify({ boletaId, actualizado: ahora })
}

export async function guardarBoleta(datos: DatosBoleta, id?: number): Promise<number> {
  const ahora = ahoraISO()
  let boletaId = id
  await db.transaction('rw', db.boletas, db.causas, async () => {
    if (id) {
      const anterior = await db.boletas.get(id)
      await db.boletas.put({ ...datos, id, creado: anterior?.creado ?? ahora, actualizado: ahora, ejemplo: anterior?.ejemplo })
    } else {
      boletaId = (await db.boletas.add({ ...datos, creado: ahora, actualizado: ahora })) as number
    }
    await sincronizarCausas(boletaId!, datos.causaIds ?? [])
  })
  return boletaId!
}

/** Elimina la boleta, sus pagos y la desvincula de sus causas */
export async function eliminarBoleta(id: number): Promise<void> {
  await db.transaction('rw', db.boletas, db.pagos, db.causas, async () => {
    await db.pagos.where('boletaId').equals(id).delete()
    await db.causas.where('boletaId').equals(id).modify({ boletaId: undefined })
    await db.boletas.delete(id)
  })
}

/** Pone el estado según los pagos: pagada si se cubrió el monto a cobrar */
async function actualizarEstadoPorPagos(boletaId: number): Promise<void> {
  const b = await db.boletas.get(boletaId)
  if (!b || b.estado === 'Anulada') return
  const pagos = await db.pagos.where('boletaId').equals(boletaId).toArray()
  const estado = totalPagado(b, pagos) >= b.montoCobrar ? 'Pagada' : 'Pendiente'
  if (estado !== b.estado) await db.boletas.update(boletaId, { estado, actualizado: ahoraISO() })
}

export async function registrarPago(p: Omit<Pago, 'id' | 'creado' | 'actualizado'>): Promise<void> {
  const ahora = ahoraISO()
  await db.pagos.add({ ...p, creado: ahora, actualizado: ahora })
  await actualizarEstadoPorPagos(p.boletaId)
}

export async function eliminarPago(id: number): Promise<void> {
  const p = await db.pagos.get(id)
  if (!p) return
  await db.pagos.delete(id)
  await actualizarEstadoPorPagos(p.boletaId)
}

/** Busca el cliente de una boleta por RUT (o por nombre si no hay RUT) */
export function encontrarCliente(clientes: Cliente[], rut?: string, nombre?: string): Cliente | undefined {
  if (rut) {
    const r = limpiarRut(rut)
    const porRut = clientes.find((c) => c.rut && limpiarRut(c.rut) === r)
    if (porRut) return porRut
  }
  if (nombre) return clientes.find((c) => normalizar(c.nombre) === normalizar(nombre))
  return undefined
}

// Operaciones del módulo Clientes: guardar, eliminar, fusionar y calcular resúmenes.
import { ahoraISO, db } from '../../db/basedatos'
import type { Ajustes, Boleta, Causa, Cliente, Pago, Retiro } from '../../db/tipos'
import { revisarRut } from '../../utilidades/rut'
import { nombresParecidos, normalizar } from '../../utilidades/texto'
import { promedioDiasPago, saldoBoleta } from '../boletas/calculos'
import { causaAtrasada } from '../causas/prioridad'

export type DatosCliente = Pick<Cliente, 'nombre' | 'rut' | 'contacto' | 'correo' | 'telefono' | 'notas'>

export interface ResultadoValidacion {
  errores: Partial<Record<keyof DatosCliente, string>>
  datos: DatosCliente
}

/** Revisa los datos del formulario y los deja limpios (RUT con formato, espacios quitados) */
export function validarCliente(datos: DatosCliente): ResultadoValidacion {
  const errores: ResultadoValidacion['errores'] = {}
  const limpio: DatosCliente = {
    nombre: datos.nombre.trim(),
    contacto: datos.contacto?.trim() || undefined,
    correo: datos.correo?.trim() || undefined,
    telefono: datos.telefono?.trim() || undefined,
    notas: datos.notas?.trim() || undefined,
  }
  if (!limpio.nombre) errores.nombre = 'Escriba el nombre del cliente o estudio jurídico.'
  const rut = revisarRut(datos.rut)
  if (rut.error) errores.rut = rut.error
  limpio.rut = rut.valor
  if (limpio.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(limpio.correo)) {
    errores.correo = 'El correo no parece válido. Ejemplo: contacto@estudio.cl'
  }
  return { errores, datos: limpio }
}

/** Busca otro cliente con el mismo nombre (sin importar tildes) o el mismo RUT */
export async function buscarRepetido(datos: DatosCliente, excluirId?: number): Promise<Cliente | undefined> {
  const todos = await db.clientes.toArray()
  const nombre = normalizar(datos.nombre)
  return todos.find((c) => c.id !== excluirId && (normalizar(c.nombre) === nombre || (!!datos.rut && c.rut === datos.rut)))
}

export async function guardarCliente(datos: DatosCliente, id?: number): Promise<number> {
  const ahora = ahoraISO()
  if (id) {
    await db.clientes.update(id, { ...datos, actualizado: ahora })
    return id
  }
  return (await db.clientes.add({ ...datos, creado: ahora, actualizado: ahora })) as number
}

/** Crea un cliente solo con su nombre (desde otros formularios), o devuelve el existente si ya está */
export async function crearClienteRapido(nombre: string): Promise<number> {
  const existente = await buscarRepetido({ nombre })
  if (existente?.id) return existente.id
  return guardarCliente({ nombre: nombre.trim() })
}

/** Cuántos registros están vinculados a un cliente */
export async function vinculosCliente(id: number) {
  const [causas, retiros, boletas] = await Promise.all([
    db.causas.where('clienteId').equals(id).count(),
    db.retiros.where('clienteId').equals(id).count(),
    db.boletas.where('clienteId').equals(id).count(),
  ])
  return { causas, retiros, boletas, total: causas + retiros + boletas }
}

/** Elimina un cliente. Sus causas, retiros y boletas se conservan, pero quedan sin cliente asignado. */
export async function eliminarCliente(id: number): Promise<void> {
  await db.transaction('rw', db.clientes, db.causas, db.retiros, db.boletas, async () => {
    await db.causas.where('clienteId').equals(id).modify({ clienteId: undefined })
    await db.retiros.where('clienteId').equals(id).modify({ clienteId: undefined })
    await db.boletas.where('clienteId').equals(id).modify({ clienteId: undefined })
    await db.clientes.delete(id)
  })
}

/**
 * Une varios clientes en uno solo.
 * Todas las causas, retiros y boletas pasan al cliente que se conserva.
 * Los datos que le falten al cliente conservado se completan con los de los otros.
 */
export async function fusionarClientes(conservarId: number, unirIds: number[]): Promise<void> {
  const otros = unirIds.filter((x) => x !== conservarId)
  if (otros.length === 0) return
  await db.transaction('rw', db.clientes, db.causas, db.retiros, db.boletas, async () => {
    const principal = await db.clientes.get(conservarId)
    if (!principal) throw new Error('No se encontró el cliente que se va a conservar.')
    const unidos = (await db.clientes.bulkGet(otros)).filter((c): c is Cliente => !!c)
    const completado: Partial<Cliente> = {}
    for (const campo of ['rut', 'contacto', 'correo', 'telefono'] as const) {
      if (!principal[campo]) {
        const valor = unidos.find((c) => c[campo])?.[campo]
        if (valor) completado[campo] = valor
      }
    }
    const notas = [principal.notas, ...unidos.map((c) => c.notas)].filter(Boolean)
    if (notas.length) completado.notas = Array.from(new Set(notas)).join('\n')
    await db.clientes.update(conservarId, { ...completado, actualizado: ahoraISO() })
    await db.causas.where('clienteId').anyOf(otros).modify({ clienteId: conservarId })
    await db.retiros.where('clienteId').anyOf(otros).modify({ clienteId: conservarId })
    await db.boletas.where('clienteId').anyOf(otros).modify({ clienteId: conservarId })
    await db.clientes.bulkDelete(otros)
  })
}

/** Grupos de clientes con nombres parecidos o el mismo RUT, para sugerir fusiones */
export function sugerirFusiones(clientes: Cliente[]): Cliente[][] {
  const usados = new Set<number>()
  const grupos: Cliente[][] = []
  for (const c of clientes) {
    if (!c.id || usados.has(c.id)) continue
    const grupo = clientes.filter(
      (o) => o.id && !usados.has(o.id) && (o.id === c.id || nombresParecidos(c.nombre, o.nombre) || (!!c.rut && c.rut === o.rut)),
    )
    if (grupo.length > 1) {
      grupo.forEach((g) => usados.add(g.id!))
      grupos.push(grupo)
    }
  }
  return grupos
}

export interface ResumenCliente {
  causasPendientes: number
  causasRealizadas: number
  causasAtrasadas: number
  retirosActivos: number
  adeudado: number
  boletasImpagas: number
  promedioPago: number | null
}

const ESTADOS_RETIRO_ACTIVOS = new Set(['Pendiente', 'En búsqueda'])

/** Resumen de causas, retiros y boletas de un cliente */
export function resumirCliente(
  clienteId: number,
  datos: { causas: Causa[]; retiros: Retiro[]; boletas: Boleta[]; pagos: Pago[] },
  umbrales: Ajustes['umbralesCausas'],
): ResumenCliente {
  const causas = datos.causas.filter((c) => c.clienteId === clienteId)
  const retiros = datos.retiros.filter((r) => r.clienteId === clienteId)
  const boletas = datos.boletas.filter((b) => b.clienteId === clienteId && b.estado !== 'Anulada')
  const impagas = boletas.filter((b) => saldoBoleta(b, datos.pagos) > 0)
  return {
    causasPendientes: causas.filter((c) => c.estado === 'Pendiente').length,
    causasRealizadas: causas.filter((c) => c.estado === 'Realizada').length,
    causasAtrasadas: causas.filter((c) => causaAtrasada(c, umbrales)).length,
    retirosActivos: retiros.filter((r) => ESTADOS_RETIRO_ACTIVOS.has(r.estado)).length,
    adeudado: impagas.reduce((s, b) => s + saldoBoleta(b, datos.pagos), 0),
    boletasImpagas: impagas.length,
    promedioPago: promedioDiasPago(boletas, datos.pagos),
  }
}

// Decide qué hacer con cada boleta leída de los archivos del SII:
// agregarla, actualizar la que ya existe (mismo N°) u omitirla si no cambió nada.
import type { Ajustes, Boleta, Causa, Cliente } from '../../../db/tipos'
import { diasEntre, fechaCL, hoyISO, pesos } from '../../../utilidades/formato'
import { normalizarRol, nucleoRol } from '../../causas/servicioCausas'
import { calcularMontos } from '../calculos'
import { encontrarCliente, type DatosBoleta } from '../servicioBoletas'
import type { BoletaLeida } from './leerArchivosSii'

export type AccionBoleta = 'nueva' | 'actualizar' | 'omitir'

export interface BoletaAnalizada {
  leida: BoletaLeida
  accion: AccionBoleta
  sugerida: AccionBoleta
  existente?: Boleta
  /** Qué cambia respecto de la boleta guardada */
  cambios: string[]
  avisos: string[]
  /** Datos listos para guardar */
  datos: DatosBoleta
  clienteNuevo: boolean
  causasPropuestas: Causa[]
}

/** Une lo leído del PDF (trae la glosa) con lo del informe (trae el estado) cuando es la misma boleta */
export function unirLecturas(lecturas: BoletaLeida[]): BoletaLeida[] {
  const porNumero = new Map<number, BoletaLeida>()
  for (const l of lecturas) {
    const prev = porNumero.get(l.numero)
    if (!prev) {
      porNumero.set(l.numero, l)
      continue
    }
    const pdf = prev.origen === 'pdf' ? prev : l
    const informe = prev.origen === 'informe' ? prev : l
    porNumero.set(l.numero, {
      ...pdf,
      ...informe,
      glosa: pdf.glosa ?? informe.glosa,
      roles: Array.from(new Set([...pdf.roles, ...informe.roles])),
      anulada: pdf.anulada || informe.anulada,
      fechaAnulacion: informe.fechaAnulacion ?? pdf.fechaAnulacion,
      archivo: prev.archivo === l.archivo ? l.archivo : `${prev.archivo} y ${l.archivo}`,
    })
  }
  return [...porNumero.values()].sort((a, b) => a.numero - b.numero)
}

export function analizarBoletas(lecturas: BoletaLeida[], existentes: Boleta[], clientes: Cliente[], causas: Causa[], ajustes: Ajustes): BoletaAnalizada[] {
  const hoy = hoyISO()
  const porNumero = new Map(existentes.map((b) => [b.numero, b]))
  return unirLecturas(lecturas).map((l) => {
    const avisos: string[] = []
    const existente = porNumero.get(l.numero)
    const cliente = encontrarCliente(clientes, l.rutCliente, l.nombreCliente)
    const pct = l.porcentajeRetencion && Math.abs(l.porcentajeRetencion - ajustes.porcentajeRetencion) < 0.1 ? ajustes.porcentajeRetencion : (l.porcentajeRetencion ?? ajustes.porcentajeRetencion)
    const montos = calcularMontos(l.bruto, pct, l.pagaRetencion)

    // Causas cuyo ROL aparece en la glosa (preferentemente del mismo cliente)
    const causasPropuestas = l.roles.flatMap((rol) => {
      const iguales = causas.filter((c) => c.rol === normalizarRol(rol) || nucleoRol(c.rol) === nucleoRol(rol))
      const delCliente = iguales.filter((c) => cliente?.id && c.clienteId === cliente.id)
      return (delCliente.length ? delCliente : iguales).slice(0, 1)
    })

    if (!l.fechaEmision) avisos.push('Sin fecha de emisión: revise el archivo')
    else if (diasEntre(l.fechaEmision, hoy) > 365) avisos.push(`Boleta de hace más de un año (${fechaCL(l.fechaEmision)})`)
    if (l.anulada) avisos.push('ANULADA en el SII: no entra en totales ni alertas')
    if (Math.abs(l.bruto - l.retencion - l.liquido) > 1) avisos.push(`Los montos no cuadran: bruto ${pesos(l.bruto)} menos retención ${pesos(l.retencion)} no da ${pesos(l.liquido)}`)
    if (!cliente && (l.nombreCliente || l.rutCliente)) avisos.push('Cliente nuevo: se creará')

    const datos: DatosBoleta = {
      numero: l.numero,
      fechaEmision: l.fechaEmision ?? hoy,
      clienteId: cliente?.id,
      nombreCliente: l.nombreCliente,
      rutCliente: l.rutCliente,
      glosa: l.glosa,
      bruto: l.bruto,
      porcentajeRetencion: pct,
      ...montos,
      pagaRetencion: l.pagaRetencion,
      estado: l.anulada ? 'Anulada' : 'Pendiente',
      fechaAnulacion: l.anulada ? l.fechaAnulacion : undefined,
      causaIds: causasPropuestas.map((c) => c.id!),
      origen: l.origen,
    }

    const base = { leida: l, avisos, clienteNuevo: !cliente && !!(l.nombreCliente || l.rutCliente), causasPropuestas }
    if (!existente) return { ...base, accion: 'nueva', sugerida: 'nueva', cambios: [], datos }

    // Ya existe: se conservan los pagos, la nota y las causas; se actualiza lo que trae el SII
    const cambios: string[] = []
    if (l.anulada && existente.estado !== 'Anulada') cambios.push('Pasa a ANULADA')
    if (!l.anulada && existente.estado === 'Anulada') cambios.push('Vuelve a estar vigente')
    if (existente.bruto !== l.bruto) cambios.push(`Bruto ${pesos(existente.bruto)} → ${pesos(l.bruto)}`)
    if (existente.pagaRetencion !== l.pagaRetencion) cambios.push('Cambia quién paga la retención')
    if (!existente.glosa && l.glosa) cambios.push('Agrega la glosa')
    if (!existente.rutCliente && l.rutCliente) cambios.push('Agrega el RUT del cliente')
    if (!existente.clienteId && cliente?.id) cambios.push('Asocia el cliente')
    const nuevasCausas = datos.causaIds!.filter((id) => !(existente.causaIds ?? []).includes(id))
    if (nuevasCausas.length) cambios.push('Asocia causas de la glosa')

    const actualizada: DatosBoleta = {
      ...existente,
      ...datos,
      clienteId: existente.clienteId ?? datos.clienteId,
      nombreCliente: existente.nombreCliente ?? datos.nombreCliente,
      rutCliente: existente.rutCliente ?? datos.rutCliente,
      glosa: existente.glosa ?? datos.glosa,
      nota: existente.nota,
      causaIds: Array.from(new Set([...(existente.causaIds ?? []), ...datos.causaIds!])),
      // Una boleta pagada sigue pagada salvo que el SII diga que se anuló
      estado: l.anulada ? 'Anulada' : existente.estado === 'Anulada' ? 'Pendiente' : existente.estado,
      origen: existente.origen ?? datos.origen,
    }
    delete (actualizada as Partial<Boleta>).id
    delete (actualizada as Partial<Boleta>).creado
    delete (actualizada as Partial<Boleta>).actualizado
    delete (actualizada as Partial<Boleta>).ejemplo
    const accion: AccionBoleta = cambios.length ? 'actualizar' : 'omitir'
    return { ...base, existente, accion, sugerida: accion, cambios: cambios.length ? cambios : ['Ya está guardada y no cambió'], datos: actualizada }
  })
}

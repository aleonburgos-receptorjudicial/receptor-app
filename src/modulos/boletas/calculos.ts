// Cálculos de boletas: saldo pendiente y tiempo de pago.
// Las boletas ANULADAS nunca entran en estos cálculos.
import type { Boleta, Pago } from '../../db/tipos'
import { diasEntre } from '../../utilidades/formato'

/** Suma de los pagos registrados para una boleta */
export function totalPagado(boleta: Boleta, pagos: Pago[]): number {
  return pagos.filter((p) => p.boletaId === boleta.id).reduce((s, p) => s + p.monto, 0)
}

/** Lo que falta por cobrar de una boleta (0 si está pagada o anulada) */
export function saldoBoleta(boleta: Boleta, pagos: Pago[]): number {
  if (boleta.estado !== 'Pendiente') return 0
  return Math.max(0, boleta.montoCobrar - totalPagado(boleta, pagos))
}

/** Días que demoró el pago de una boleta pagada (hasta el último pago), o null si no aplica */
export function diasHastaPago(boleta: Boleta, pagos: Pago[]): number | null {
  if (boleta.estado !== 'Pagada') return null
  const propios = pagos.filter((p) => p.boletaId === boleta.id).map((p) => p.fecha).sort()
  const ultimo = propios[propios.length - 1]
  if (!ultimo) return null
  return Math.max(0, diasEntre(boleta.fechaEmision, ultimo))
}

/** Promedio de días de pago de un conjunto de boletas, o null si no hay boletas pagadas */
export function promedioDiasPago(boletas: Boleta[], pagos: Pago[]): number | null {
  const dias = boletas.map((b) => diasHastaPago(b, pagos)).filter((d): d is number => d !== null)
  if (dias.length === 0) return null
  return Math.round(dias.reduce((s, d) => s + d, 0) / dias.length)
}

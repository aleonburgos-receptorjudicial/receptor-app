// Cálculos de boletas: montos, saldo pendiente, tiempo de pago, alertas e indicadores.
// Las boletas ANULADAS nunca entran en totales, gráficos, alertas ni barras de progreso.
import type { Ajustes, Boleta, Cliente, Pago, PagadorRetencion } from '../../db/tipos'
import { diasEntre, hoyISO } from '../../utilidades/formato'
import { normalizar } from '../../utilidades/texto'

/** Retención, líquido y monto a cobrar a partir del bruto */
export function calcularMontos(bruto: number, porcentaje: number, paga: PagadorRetencion) {
  // Se calcula con enteros para redondear igual que el SII (la mitad sube): 85.000 × 15,25 % = 12.962,5 → 12.963
  const centesimas = Math.round(porcentaje * 100)
  const retencion = Math.floor((Math.round(bruto) * centesimas + 5000) / 10000)
  const liquido = bruto - retencion
  // Si el cliente retiene, paga el líquido; si la retención la paga la receptora, el cliente paga el bruto
  return { retencion, liquido, montoCobrar: paga === 'Cliente' ? liquido : bruto }
}

export const vigente = (b: Boleta) => b.estado !== 'Anulada'

/** Suma de los pagos registrados para una boleta */
export function totalPagado(boleta: Boleta, pagos: Pago[]): number {
  return pagos.filter((p) => p.boletaId === boleta.id).reduce((s, p) => s + p.monto, 0)
}

/** Lo que falta por cobrar de una boleta (0 si está pagada o anulada) */
export function saldoBoleta(boleta: Boleta, pagos: Pago[]): number {
  if (boleta.estado !== 'Pendiente') return 0
  return Math.max(0, boleta.montoCobrar - totalPagado(boleta, pagos))
}

/** Lo cobrado de una boleta: pagos registrados, o el total si se marcó pagada sin registrar pagos */
export function cobradoBoleta(boleta: Boleta, pagos: Pago[]): number {
  if (!vigente(boleta)) return 0
  const pagado = totalPagado(boleta, pagos)
  if (boleta.estado === 'Pagada') return Math.max(pagado, boleta.montoCobrar)
  return Math.min(pagado, boleta.montoCobrar)
}

/** Días desde la emisión (para boletas impagas) */
export function diasDesdeEmision(b: Pick<Boleta, 'fechaEmision'>, hoy = hoyISO()): number {
  return Math.max(0, diasEntre(b.fechaEmision, hoy))
}

/** Días que demoró el pago de una boleta pagada (hasta el último pago), o null si no aplica */
export function diasHastaPago(boleta: Boleta, pagos: Pago[]): number | null {
  if (boleta.estado !== 'Pagada') return null
  const propios = pagos.filter((p) => p.boletaId === boleta.id).map((p) => p.fecha).sort()
  const ultimo = propios[propios.length - 1]
  if (!ultimo) return null
  return Math.max(0, diasEntre(boleta.fechaEmision, ultimo))
}

/** Promedio de días de pago de un conjunto de boletas, o null si no hay boletas pagadas con fecha */
export function promedioDiasPago(boletas: Boleta[], pagos: Pago[]): number | null {
  const dias = boletas.map((b) => diasHastaPago(b, pagos)).filter((d): d is number => d !== null)
  if (dias.length === 0) return null
  return Math.round(dias.reduce((s, d) => s + d, 0) / dias.length)
}

export type NivelBoleta = 'reciente' | 'primera' | 'segunda' | 'tercera'

/** Alerta de una boleta impaga según los días desde la emisión (30 / 60 / 90 configurables) */
export function nivelBoleta(b: Boleta, pagos: Pago[], u: Ajustes['umbralesBoletas'], hoy = hoyISO()): NivelBoleta | null {
  if (saldoBoleta(b, pagos) <= 0) return null
  const d = diasDesdeEmision(b, hoy)
  if (d >= u.tercera) return 'tercera'
  if (d >= u.segunda) return 'segunda'
  if (d >= u.primera) return 'primera'
  return 'reciente'
}

export interface Indicadores {
  totalVigente: number
  cobrado: number
  porCobrar: number
  enAlerta: number
  retenciones: number
  promedioPago: number | null
  vigentes: number
  impagas: number
  anuladas: number
}

export function indicadores(boletas: Boleta[], pagos: Pago[], u: Ajustes['umbralesBoletas'], hoy = hoyISO()): Indicadores {
  const vig = boletas.filter(vigente)
  const impagas = vig.filter((b) => saldoBoleta(b, pagos) > 0)
  return {
    totalVigente: vig.reduce((s, b) => s + b.montoCobrar, 0),
    cobrado: vig.reduce((s, b) => s + cobradoBoleta(b, pagos), 0),
    porCobrar: impagas.reduce((s, b) => s + saldoBoleta(b, pagos), 0),
    enAlerta: impagas.filter((b) => diasDesdeEmision(b, hoy) >= u.primera).reduce((s, b) => s + saldoBoleta(b, pagos), 0),
    retenciones: vig.reduce((s, b) => s + b.retencion, 0),
    promedioPago: promedioDiasPago(vig, pagos),
    vigentes: vig.length,
    impagas: impagas.length,
    anuladas: boletas.length - vig.length,
  }
}

/** Deuda por antigüedad: 0–30, 31–60, 61–90 y más de 90 días (según los umbrales) */
export function antiguedadDeuda(boletas: Boleta[], pagos: Pago[], u: Ajustes['umbralesBoletas'], hoy = hoyISO()) {
  const tramos = [
    { tramo: `0 a ${u.primera} días`, nivel: 'reciente' as NivelBoleta, monto: 0, cantidad: 0 },
    { tramo: `${u.primera + 1} a ${u.segunda} días`, nivel: 'primera' as NivelBoleta, monto: 0, cantidad: 0 },
    { tramo: `${u.segunda + 1} a ${u.tercera} días`, nivel: 'segunda' as NivelBoleta, monto: 0, cantidad: 0 },
    { tramo: `Más de ${u.tercera} días`, nivel: 'tercera' as NivelBoleta, monto: 0, cantidad: 0 },
  ]
  for (const b of boletas.filter(vigente)) {
    const saldo = saldoBoleta(b, pagos)
    if (saldo <= 0) continue
    const d = diasDesdeEmision(b, hoy)
    const i = d > u.tercera ? 3 : d > u.segunda ? 2 : d > u.primera ? 1 : 0
    tramos[i].monto += saldo
    tramos[i].cantidad++
  }
  return tramos
}

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

/** Emisión mensual de los últimos meses: lo cobrado y lo que falta por cobrar de lo emitido cada mes */
export function emisionMensual(boletas: Boleta[], pagos: Pago[], meses = 12, hoy = hoyISO()) {
  const [a, m] = hoy.split('-').map(Number)
  const lista: { clave: string; mes: string; pagado: number; porCobrar: number; cantidad: number }[] = []
  for (let i = meses - 1; i >= 0; i--) {
    const fecha = new Date(a, m - 1 - i, 1)
    const clave = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`
    lista.push({ clave, mes: `${MESES[fecha.getMonth()]} ${String(fecha.getFullYear()).slice(2)}`, pagado: 0, porCobrar: 0, cantidad: 0 })
  }
  for (const b of boletas.filter(vigente)) {
    const fila = lista.find((x) => x.clave === b.fechaEmision.slice(0, 7))
    if (!fila) continue
    fila.pagado += cobradoBoleta(b, pagos)
    fila.porCobrar += saldoBoleta(b, pagos)
    fila.cantidad++
  }
  return lista
}

export interface ResumenClienteBoletas {
  clave: string
  clienteId?: number
  nombre: string
  rut?: string
  pagado: number
  adeudado: number
  impagas: number
  masAntigua: number
  promedioPago: number | null
}

/** Pagado y adeudado por cliente (solo boletas vigentes) */
export function porCliente(boletas: Boleta[], pagos: Pago[], clientes: Cliente[], hoy = hoyISO()): ResumenClienteBoletas[] {
  const nombre = new Map(clientes.map((c) => [c.id, c]))
  const grupos = new Map<string, Boleta[]>()
  for (const b of boletas.filter(vigente)) {
    const clave = b.clienteId ? `id${b.clienteId}` : `n${normalizar(b.nombreCliente ?? 'sin cliente')}`
    grupos.set(clave, [...(grupos.get(clave) ?? []), b])
  }
  return [...grupos.entries()]
    .map(([clave, lista]) => {
      const c = lista[0].clienteId ? nombre.get(lista[0].clienteId) : undefined
      const impagas = lista.filter((b) => saldoBoleta(b, pagos) > 0)
      return {
        clave,
        clienteId: lista[0].clienteId,
        nombre: c?.nombre ?? lista[0].nombreCliente ?? 'Sin cliente',
        rut: c?.rut ?? lista[0].rutCliente,
        pagado: lista.reduce((s, b) => s + cobradoBoleta(b, pagos), 0),
        adeudado: impagas.reduce((s, b) => s + saldoBoleta(b, pagos), 0),
        impagas: impagas.length,
        masAntigua: Math.max(0, ...impagas.map((b) => diasDesdeEmision(b, hoy))),
        promedioPago: promedioDiasPago(lista, pagos),
      }
    })
    .sort((a, b) => b.adeudado - a.adeudado || b.pagado - a.pagado)
}

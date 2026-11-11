// Formatos chilenos: fechas DD-MM-AAAA y montos en pesos ($1.234.567).

/** Convierte "AAAA-MM-DD" (o una fecha ISO completa) a "DD-MM-AAAA" */
export function fechaCL(iso: string | undefined | null): string {
  if (!iso) return '—'
  const [a, m, d] = iso.slice(0, 10).split('-')
  if (!a || !m || !d) return iso
  return `${d}-${m}-${a}`
}

/** Fecha de hoy en formato interno "AAAA-MM-DD" (hora local de Chile del equipo) */
export function hoyISO(): string {
  const h = new Date()
  const m = String(h.getMonth() + 1).padStart(2, '0')
  const d = String(h.getDate()).padStart(2, '0')
  return `${h.getFullYear()}-${m}-${d}`
}

/** Suma (o resta) días a una fecha "AAAA-MM-DD" */
export function sumarDias(iso: string, dias: number): string {
  const [a, m, d] = iso.split('-').map(Number)
  const f = new Date(a, m - 1, d + dias)
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`
}

/** Días transcurridos entre dos fechas "AAAA-MM-DD" (desde → hasta) */
export function diasEntre(desde: string, hasta: string): number {
  const [a1, m1, d1] = desde.slice(0, 10).split('-').map(Number)
  const [a2, m2, d2] = hasta.slice(0, 10).split('-').map(Number)
  const ms = Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)
  return Math.round(ms / 86_400_000)
}

const formatoPesos = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 })

/** Monto en pesos chilenos: $1.234.567 */
export function pesos(monto: number | undefined | null): string {
  if (monto === undefined || monto === null || Number.isNaN(monto)) return '$0'
  const signo = monto < 0 ? '-' : ''
  return `${signo}$${formatoPesos.format(Math.abs(Math.round(monto)))}`
}

/** Número con separador de miles: 1.234 */
export function numeroCL(n: number): string {
  return formatoPesos.format(n)
}

/** Texto en singular o plural según la cantidad: "1 cliente", "3 clientes" */
export function plural(n: number, singular: string, pluralTexto: string): string {
  return `${numeroCL(n)} ${n === 1 ? singular : pluralTexto}`
}

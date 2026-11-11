// Días restantes hasta el vencimiento de un retiro y su color de alerta.
import type { Ajustes, Retiro } from '../../db/tipos'
import { diasEntre, hoyISO } from '../../utilidades/formato'

export type NivelVencimiento = 'verde' | 'amarillo' | 'naranja' | 'vencido'

/** Solo los retiros en curso tienen plazo que vigilar */
export const ESTADOS_RETIRO_ACTIVOS: ReadonlySet<Retiro['estado']> = new Set(['Pendiente', 'En búsqueda'])

export function retiroActivo(r: Pick<Retiro, 'estado'>): boolean {
  return ESTADOS_RETIRO_ACTIVOS.has(r.estado)
}

/** Días que faltan para el vencimiento (negativo si ya venció) */
export function diasRestantes(r: Pick<Retiro, 'fechaVencimiento'>, hoy = hoyISO()): number {
  return diasEntre(hoy, r.fechaVencimiento)
}

/**
 * Color según los días restantes (umbrales configurables):
 * más de "verde" días → verde; desde "amarillo" hasta "verde" → amarillo; de 0 a "amarillo"-1 → naranja; vencido → rojo.
 */
export function nivelVencimiento(r: Retiro, umbrales: Ajustes['umbralesRetiros'], hoy = hoyISO()): NivelVencimiento | null {
  if (!retiroActivo(r)) return null
  const d = diasRestantes(r, hoy)
  if (d < 0) return 'vencido'
  if (d > umbrales.verde) return 'verde'
  if (d >= umbrales.amarillo) return 'amarillo'
  return 'naranja'
}

/** Retiros en curso que vencen dentro de los próximos "dias" días (sin contar los ya vencidos) */
export function retirosPorVencer(retiros: Retiro[], dias = 7, hoy = hoyISO()): Retiro[] {
  return retiros.filter((r) => retiroActivo(r) && diasRestantes(r, hoy) >= 0 && diasRestantes(r, hoy) <= dias)
}

export function retirosVencidos(retiros: Retiro[], hoy = hoyISO()): Retiro[] {
  return retiros.filter((r) => retiroActivo(r) && diasRestantes(r, hoy) < 0)
}

/** Texto corto para la etiqueta: "Vence hoy", "Faltan 3 días", "Vencido hace 2 días" */
export function textoVencimiento(dias: number): string {
  if (dias === 0) return 'Vence hoy'
  if (dias === 1) return 'Vence mañana'
  if (dias > 1) return `Faltan ${dias} días`
  if (dias === -1) return 'Venció ayer'
  return `Vencido hace ${-dias} días`
}

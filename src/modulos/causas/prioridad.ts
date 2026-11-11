// Prioridad de una causa según los días transcurridos desde el encargo.
import type { Ajustes, Causa } from '../../db/tipos'
import { diasEntre, hoyISO } from '../../utilidades/formato'

export type NivelPrioridad = 'reciente' | 'media' | 'alta' | 'maxima'

export function diasDesdeEncargo(causa: Pick<Causa, 'fechaEncargo'>, hoy = hoyISO()): number {
  return Math.max(0, diasEntre(causa.fechaEncargo, hoy))
}

/** Devuelve la prioridad de una causa pendiente; las realizadas y suspendidas no tienen prioridad */
export function prioridadCausa(causa: Causa, umbrales: Ajustes['umbralesCausas'], hoy = hoyISO()): NivelPrioridad | null {
  if (causa.estado !== 'Pendiente') return null
  const dias = diasDesdeEncargo(causa, hoy)
  if (dias <= umbrales.reciente) return 'reciente'
  if (dias <= umbrales.media) return 'media'
  if (dias <= umbrales.alta) return 'alta'
  return 'maxima'
}

export function causaAtrasada(causa: Causa, umbrales: Ajustes['umbralesCausas'], hoy = hoyISO()): boolean {
  return prioridadCausa(causa, umbrales, hoy) === 'maxima'
}

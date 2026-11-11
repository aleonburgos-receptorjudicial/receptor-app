// Enlaces para navegar a los domicilios con Google Maps o Waze.
// La dirección sale del equipo solo cuando la usuaria toca uno de estos botones.
import type { Causa } from '../../../db/tipos'
import { normalizar } from '../../../utilidades/texto'

/** Dirección lista para buscar: si no trae comuna, se le agrega la comuna por defecto */
export function direccionNavegable(c: Pick<Causa, 'domicilio'>, comuna: string): string | null {
  const d = c.domicilio?.trim()
  if (!d || normalizar(d).startsWith('sin domicilio')) return null
  const tieneComuna = d.includes(',') || (!!comuna && normalizar(d).includes(normalizar(comuna)))
  return `${d}${!tieneComuna && comuna ? `, ${comuna}` : ''}, Chile`
}

export const urlMaps = (direccion: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccion)}`

export const urlWaze = (direccion: string) => `https://waze.com/ul?q=${encodeURIComponent(direccion)}&navigate=yes`

/** Paradas por tramo en Google Maps (el celular acepta hasta 10 puntos, contando el de partida) */
export const PARADAS_POR_TRAMO = 9

/**
 * Recorridos de Google Maps con varias paradas seguidas, partiendo desde la ubicación actual.
 * Se divide en tramos de 9 paradas.
 */
export function tramosGoogleMaps(direcciones: string[]): { desde: number; hasta: number; url: string }[] {
  const tramos: { desde: number; hasta: number; url: string }[] = []
  for (let i = 0; i < direcciones.length; i += PARADAS_POR_TRAMO) {
    const parte = direcciones.slice(i, i + PARADAS_POR_TRAMO)
    // "/dir//A/B/C": el punto de partida vacío significa "mi ubicación"
    tramos.push({ desde: i + 1, hasta: i + parte.length, url: `https://www.google.com/maps/dir//${parte.map(encodeURIComponent).join('/')}` })
  }
  return tramos
}

// Piezas visuales de los retiros: la placa patente, la etiqueta de vencimiento y el estado.
import type { Retiro } from '../../db/tipos'
import type { NivelVencimiento } from './vencimiento'
import { textoVencimiento, type AlertasRetiro } from './vencimiento'

/** Patente dibujada como placa chilena: fondo blanco, borde oscuro y "CHILE" abajo */
export function Placa({ patente, grande = false }: { patente?: string; grande?: boolean }) {
  if (!patente) return <span className="text-tenue">Sin patente</span>
  return (
    <span
      className={`inline-flex flex-col items-center rounded-md border-2 border-[#1b2a2f] bg-white px-2 pt-0.5 leading-none text-[#1b2a2f] shadow-[inset_0_0_0_2px_#fff,inset_0_0_0_3px_#1b2a2f] ${grande ? 'min-w-40 px-3 pt-1' : 'min-w-28'}`}
      aria-label={`Patente ${patente.replace(/·/g, ' ')}`}
    >
      <span className={`font-bold tracking-[0.12em] cifra ${grande ? 'text-3xl' : 'text-xl'}`}>{patente}</span>
      <span className={`font-bold tracking-[0.3em] ${grande ? 'pb-1 text-[0.6rem]' : 'pb-0.5 text-[0.5rem]'}`} aria-hidden="true">
        CHILE
      </span>
    </span>
  )
}

const ESTILO_NIVEL: Record<NivelVencimiento, { clase: string; borde: string; texto: string }> = {
  verde: { clase: 'bg-verde-suave text-verde', borde: 'border-l-verde', texto: 'Con plazo' },
  amarillo: { clase: 'bg-amarillo-suave text-amarillo', borde: 'border-l-amarillo', texto: 'Atención' },
  naranja: { clase: 'bg-naranja-suave text-naranja', borde: 'border-l-naranja', texto: 'Por vencer' },
  vencido: { clase: 'bg-rojo text-papel', borde: 'border-l-rojo', texto: 'Vencido' },
}
export const BORDE_NIVEL = (n: NivelVencimiento | null) => (n ? ESTILO_NIVEL[n].borde : 'border-l-transparent')
export const NOMBRE_NIVEL: Record<NivelVencimiento, string> = {
  verde: 'Con plazo',
  amarillo: 'Atención',
  naranja: 'Por vencer',
  vencido: 'Vencidos',
}

/** Píldora con los días que faltan para el vencimiento */
export function EtiquetaVencimiento({ nivel, dias }: { nivel: NivelVencimiento | null; dias: number }) {
  if (!nivel) return null
  return <span className={`inline-flex whitespace-nowrap rounded-full px-3 py-0.5 text-sm font-bold cifra ${ESTILO_NIVEL[nivel].clase}`}>{textoVencimiento(dias)}</span>
}

const COLOR_ESTADO: Record<Retiro['estado'], string> = {
  Pendiente: 'border-petroleo text-petroleo',
  'En búsqueda': 'border-petroleo bg-petroleo-suave text-petroleo',
  Retirado: 'border-borde bg-papel text-tinta',
  'No encontrado': 'border-borde text-tenue',
  Suspendido: 'border-borde text-tenue',
}

export function EstadoRetiro({ estado }: { estado: Retiro['estado'] }) {
  return <span className={`whitespace-nowrap rounded-md border px-2 py-0.5 text-sm font-bold ${COLOR_ESTADO[estado]}`}>{estado}</span>
}

/** Etiquetas de alerta: oficio vencido, pedir renovación y prioridad de búsqueda */
export function EtiquetasAlerta({ alertas }: { alertas: AlertasRetiro }) {
  if (!alertas.vencido && !alertas.renovar && !alertas.prioridad) return null
  return (
    <span className="flex flex-wrap gap-1">
      {alertas.vencido && <span className="whitespace-nowrap rounded-md bg-rojo px-2 py-0.5 text-sm font-bold text-papel">Oficio vencido</span>}
      {alertas.renovar && <span className="whitespace-nowrap rounded-md border border-naranja bg-naranja-suave px-2 py-0.5 text-sm font-bold text-naranja">Pedir renovación</span>}
      {alertas.prioridad && <span className="whitespace-nowrap rounded-md border border-amarillo bg-amarillo-suave px-2 py-0.5 text-sm font-bold text-amarillo">Prioridad de búsqueda</span>}
    </span>
  )
}

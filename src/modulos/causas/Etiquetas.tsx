// Etiquetas de color para la prioridad (días desde el encargo), el estado y la etapa de una causa.
import type { Causa } from '../../db/tipos'
import { plural } from '../../utilidades/formato'
import type { NivelPrioridad } from './prioridad'
import { etapaCausa } from './servicioCausas'

export const PRIORIDADES: Record<NivelPrioridad, { texto: string; clase: string; borde: string }> = {
  reciente: { texto: 'Reciente', clase: 'bg-verde-suave text-verde', borde: 'border-l-verde' },
  media: { texto: 'Media', clase: 'bg-amarillo-suave text-amarillo', borde: 'border-l-amarillo' },
  alta: { texto: 'Alta', clase: 'bg-naranja-suave text-naranja', borde: 'border-l-naranja' },
  maxima: { texto: 'Atrasada', clase: 'bg-rojo-suave text-rojo', borde: 'border-l-rojo' },
}

/** Píldora con los días transcurridos y el color de prioridad */
export function EtiquetaPrioridad({ nivel, dias }: { nivel: NivelPrioridad | null; dias: number }) {
  if (!nivel) return null
  const p = PRIORIDADES[nivel]
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-3 py-0.5 text-sm font-bold cifra ${p.clase}`}>
      {plural(dias, 'día', 'días')}
      <span className="font-normal">· {p.texto}</span>
    </span>
  )
}

const COLOR_ESTADO: Record<Causa['estado'], string> = {
  Pendiente: 'border-petroleo text-petroleo',
  Realizada: 'border-borde bg-papel text-tinta',
  Suspendida: 'border-borde text-tenue',
  Devuelta: 'border-borde text-tenue line-through decoration-1',
}

export function EtiquetaEstado({ causa }: { causa: Causa }) {
  const etapa = etapaCausa(causa)
  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <span className={`whitespace-nowrap rounded-md border px-2 py-0.5 text-sm font-bold ${COLOR_ESTADO[causa.estado]}`}>
        {causa.estado}
        {causa.estado === 'Realizada' && causa.resultado ? ` · ${causa.resultado.toLowerCase()}` : ''}
      </span>
      {etapa && <span className={`text-sm ${etapa.falta ? 'font-bold text-naranja' : 'text-tenue'}`}>{etapa.texto}</span>}
    </span>
  )
}

export function MarcaUrgente() {
  return <span className="rounded-md bg-rojo px-2 py-0.5 text-sm font-bold text-white">Urgente</span>
}

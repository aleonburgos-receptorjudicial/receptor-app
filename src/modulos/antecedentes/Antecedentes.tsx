// Piezas visuales de los antecedentes: panel completo (en formularios) y etiqueta corta (en listas).
import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/basedatos'
import { fechaCL } from '../../utilidades/formato'
import { antecedentesDemandado, antecedentesDomicilio, construirAntecedentes, DESCRIPCION, resumenAntecedentes, textoCorto, type Antecedente } from './antecedentes'

export { textoCorto }

/** Todos los antecedentes del equipo, siempre actualizados */
export function useAntecedentes(): Antecedente[] {
  const causas = useLiveQuery(() => db.causas.toArray(), [])
  return useMemo(() => construirAntecedentes(causas ?? []), [causas])
}

/** Etiqueta corta para las listas de causas y la ruta */
export function EtiquetaAntecedente({ lista }: { lista: Antecedente[] }) {
  const r = resumenAntecedentes(lista)
  if (!r) return null
  return (
    <span
      className={`inline-flex max-w-full items-start gap-1 rounded-md border px-2 py-0.5 text-sm font-bold ${r.negativo ? 'border-rojo bg-rojo-suave text-rojo' : 'border-petroleo bg-petroleo-suave text-petroleo'}`}
      title={r.ultimo.observaciones}
    >
      <span aria-hidden="true">{r.negativo ? '⚠' : 'ℹ'}</span>
      <span>Antecedente: {textoCorto(lista)}</span>
    </span>
  )
}

function Fila({ a }: { a: Antecedente }) {
  const negativo = a.tipos.some((t) => DESCRIPCION[t].negativo)
  return (
    <li className={`border-l-4 py-1 pl-3 ${negativo ? 'border-rojo' : 'border-petroleo'}`}>
      <p className="font-bold">
        {a.tipos.map((t) => DESCRIPCION[t].texto).join(', ')}
        <span className="font-normal text-tenue">
          {' '}
          · {a.rol}, {fechaCL(a.fecha)}
        </span>
      </p>
      {a.resultado && <p className="text-sm">Resultado: {a.resultado}</p>}
      {a.observaciones && <p className="text-sm text-tenue">«{a.observaciones}»</p>}
      {a.domicilio && <p className="text-sm text-tenue">Domicilio: {a.domicilio}</p>}
    </li>
  )
}

/** Panel con lo que se sabe del domicilio y del demandado (se muestra mientras se llena el formulario) */
export function PanelAntecedentes({
  domicilio,
  rut,
  nombre,
  excluirId,
}: {
  domicilio?: string
  rut?: string
  nombre?: string
  excluirId?: number
}) {
  const todos = useAntecedentes()
  const enDomicilio = antecedentesDomicilio(todos, domicilio, excluirId)
  const delDemandado = antecedentesDemandado(todos, rut, nombre, domicilio, excluirId)
  if (!enDomicilio.length && !delDemandado.length) return null
  const negativo = resumenAntecedentes(enDomicilio)?.negativo
  return (
    <section
      className={`flex flex-col gap-3 rounded-lg border-2 p-3 ${negativo ? 'border-rojo bg-rojo-suave' : 'border-petroleo bg-petroleo-suave'}`}
      aria-label="Antecedentes"
      role="status"
    >
      {enDomicilio.length > 0 && (
        <div>
          <p className="font-bold">{negativo ? '⚠ Hay antecedentes en este domicilio' : 'Antecedentes en este domicilio'}</p>
          <ul className="mt-1 flex flex-col gap-1">
            {enDomicilio.slice(0, 4).map((a) => (
              <Fila key={a.causaId} a={a} />
            ))}
          </ul>
          {enDomicilio.length > 4 && <p className="text-sm text-tenue">y {enDomicilio.length - 4} más.</p>}
        </div>
      )}
      {delDemandado.length > 0 && (
        <div>
          <p className="font-bold">El mismo demandado tiene diligencias en otros domicilios</p>
          <ul className="mt-1 flex flex-col gap-1">
            {delDemandado.slice(0, 4).map((a) => (
              <Fila key={a.causaId} a={a} />
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

/** Frases rápidas para las observaciones al marcar una diligencia (alimentan los antecedentes) */
export const FRASES_RAPIDAS: { texto: string; negativa: boolean }[] = [
  { texto: 'Domicilio no existe', negativa: true },
  { texto: 'No vive en el domicilio', negativa: true },
  { texto: 'Se cambió de domicilio', negativa: true },
  { texto: 'Sitio eriazo', negativa: true },
  { texto: 'Casa deshabitada', negativa: true },
  { texto: 'Perro bravo', negativa: false },
  { texto: 'Acceso difícil', negativa: false },
]

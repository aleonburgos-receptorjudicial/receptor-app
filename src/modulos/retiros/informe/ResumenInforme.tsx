// Resumen de un informe de domicilios: los domicilios ordenados del más probable al menos probable
// (según contactabilidad y calidad) y los familiares, con casillas para elegir qué agregar al retiro.
import { useEffect, useState } from 'react'
import type { DomicilioInforme, Familiar, InformeLeido } from '../../../db/tipos'
import { Boton, Casilla } from '../../../compartido/Controles'
import { Ventana } from '../../../compartido/Ventana'
import { plural } from '../../../utilidades/formato'
import { limpiarRut } from '../../../utilidades/rut'

export interface SeleccionInforme {
  domicilios: DomicilioInforme[]
  familiares: Familiar[]
  /** Completar nombre y RUT del demandado con los del informe */
  completarDemandado?: { nombre?: string; rut?: string }
  informe: InformeLeido
}

const nota = (n?: number) => (n === undefined ? '—' : n.toLocaleString('es-CL'))

/** Cinco estrellas con medias, para mostrar una nota de 0 a 5 */
export function Estrellas({ valor, etiqueta }: { valor?: number; etiqueta: string }) {
  if (valor === undefined) return <span className="text-sm text-tenue">{etiqueta}: sin nota</span>
  return (
    <span className="inline-flex items-center gap-2" aria-label={`${etiqueta}: ${nota(valor)} de 5`}>
      <span className="w-32 text-sm text-tenue">{etiqueta}</span>
      <span className="relative inline-block text-lg leading-none tracking-[0.1em]" aria-hidden="true">
        <span className="text-borde">★★★★★</span>
        <span className="absolute inset-y-0 left-0 overflow-hidden whitespace-nowrap text-petroleo" style={{ width: `${(valor / 5) * 100}%` }}>
          ★★★★★
        </span>
      </span>
      <span className="text-sm font-bold cifra">{nota(valor)}</span>
    </span>
  )
}

/** Primera parte de "San Pedro De La Paz, Concepcion, Biobio" → "San Pedro De La Paz" */
export const comunaCorta = (c?: string) => c?.split(',')[0]?.trim()

/** Texto de una línea de "Domicilios probables" a partir del informe */
export function lineaDomicilio(d: DomicilioInforme): string {
  const notas = d.contactabilidad !== undefined || d.calidad !== undefined ? `contactabilidad ${nota(d.contactabilidad)}/5, calidad ${nota(d.calidad)}/5` : ''
  const extra = [notas, d.relacion ? `relación: ${d.relacion}` : '', d.seccion !== 'Más probable' ? `domicilio ${d.seccion.toLowerCase()}` : ''].filter(Boolean).join('; ')
  return `${d.direccion}${comunaCorta(d.comuna) ? `, ${comunaCorta(d.comuna)}` : ''}${extra ? ` (${extra})` : ''}`
}

export function ResumenInforme({
  archivo,
  nombreArchivo,
  resumenGuardado,
  demandado,
  alCerrar,
  alAplicar,
}: {
  archivo: Blob | null
  nombreArchivo: string
  resumenGuardado?: InformeLeido
  demandado: { nombre?: string; rut?: string }
  alCerrar: () => void
  alAplicar: (s: SeleccionInforme) => void
}) {
  const [informe, setInforme] = useState<InformeLeido | null>(null)
  const [error, setError] = useState('')
  const [leyendo, setLeyendo] = useState(false)
  const [domSel, setDomSel] = useState<boolean[]>([])
  const [famSel, setFamSel] = useState<boolean[]>([])
  const [completar, setCompletar] = useState(true)

  useEffect(() => {
    if (!archivo) return
    let vigente = true
    setInforme(null)
    setError('')
    const preparar = (r: InformeLeido) => {
      if (!vigente) return
      setInforme(r)
      // Se marcan los domicilios con buen puntaje (6 de 10 o más); si no hay, el mejor
      const marcados = r.domicilios.map((d) => d.puntaje >= 6)
      if (!marcados.some(Boolean) && marcados.length) marcados[0] = true
      setDomSel(marcados)
      setFamSel(r.relacionados.map((x) => x.relacion.toLowerCase() !== 'titular'))
    }
    if (resumenGuardado) {
      preparar(resumenGuardado)
      return
    }
    setLeyendo(true)
    // El lector de PDF es pesado: se carga solo cuando se necesita
    import('./leerInforme')
      .then(({ leerInforme }) => leerInforme(archivo))
      .then((r) => {
        if (!r.domicilios.length && !r.relacionados.length) {
          setError('No se encontraron domicilios ni relacionados en este PDF. Puede que sea de otro formato o un documento escaneado. Igual queda guardado como adjunto.')
        }
        preparar(r)
      })
      .catch(() => vigente && setError('No se pudo leer el PDF. Puede estar dañado o protegido con clave. Igual queda guardado como adjunto.'))
      .finally(() => vigente && setLeyendo(false))
    return () => {
      vigente = false
    }
  }, [archivo, resumenGuardado])

  const rutInforme = informe?.rutTitular
  const distintoRut = !!rutInforme && !!demandado.rut && limpiarRut(rutInforme) !== limpiarRut(demandado.rut)
  const faltaDemandado = !demandado.nombre || !demandado.rut
  // Nombre del titular en orden natural (la tabla de relacionados lo trae así)
  const nombreTitular = informe?.relacionados.find((r) => r.relacion.toLowerCase() === 'titular')?.nombre ?? informe?.titular

  const aplicar = () => {
    if (!informe) return
    alAplicar({
      informe,
      domicilios: informe.domicilios.filter((_, i) => domSel[i]),
      familiares: informe.relacionados.filter((_, i) => famSel[i]).map((r) => ({ nombre: r.nombre, rut: r.rut, relacion: r.relacion })),
      completarDemandado: faltaDemandado && completar ? { nombre: demandado.nombre ? undefined : nombreTitular, rut: demandado.rut ? undefined : rutInforme } : undefined,
    })
  }

  const nDom = domSel.filter(Boolean).length
  const nFam = famSel.filter(Boolean).length

  return (
    <Ventana
      abierta={!!archivo}
      titulo="Resumen del informe"
      alCerrar={alCerrar}
      ancho="max-w-4xl"
      pie={
        <>
          <Boton variante="secundario" onClick={alCerrar}>
            Cancelar
          </Boton>
          <Boton onClick={aplicar} disabled={!informe || nDom + nFam === 0}>
            Agregar al retiro
          </Boton>
        </>
      }
    >
      <p className="text-tenue break-all">{nombreArchivo}</p>
      {leyendo && <p className="mt-4 text-lg">Leyendo el informe…</p>}
      {error && (
        <p className="mt-4 rounded-lg border-l-4 border-naranja bg-naranja-suave p-3 font-bold" role="alert">
          {error}
        </p>
      )}
      {informe && (informe.domicilios.length > 0 || informe.relacionados.length > 0) && (
        <div className="mt-4 flex flex-col gap-6">
          <div className="rounded-lg bg-papel p-3">
            <p>
              <span className="font-bold">{nombreTitular ?? 'Titular sin nombre'}</span>
              {rutInforme && <span className="cifra">, RUT {rutInforme}</span>}
            </p>
            <p className="text-sm text-tenue">
              {[informe.fuente && `Fuente: ${informe.fuente}`, informe.fechaConsulta && `consulta del ${informe.fechaConsulta}`].filter(Boolean).join(', ')}
            </p>
          </div>
          {distintoRut && (
            <p className="rounded-lg border-l-4 border-rojo bg-rojo-suave p-3 font-bold" role="alert">
              El RUT del informe ({rutInforme}) no coincide con el del demandado ({demandado.rut}). Revise que sea el informe correcto.
            </p>
          )}
          {faltaDemandado && nombreTitular && (
            <Casilla
              etiqueta="Completar nombre y RUT del demandado con los del informe"
              ayuda="Solo se completan los que están vacíos en el retiro."
              checked={completar}
              onChange={(e) => setCompletar(e.target.checked)}
            />
          )}

          <section>
            <h3 className="font-serif text-xl font-bold">Domicilios, del más probable al menos probable</h3>
            <p className="text-sm text-tenue">
              {informe.conNotas
                ? 'Ordenados por la suma de contactabilidad y calidad. Se marcan los que tienen 6 de 10 o más.'
                : 'No se pudieron leer las estrellas; se muestran en el orden del informe.'}
            </p>
            {informe.domicilios.length === 0 ? (
              <p className="mt-2 text-tenue">El informe no trae domicilios.</p>
            ) : (
              <ol className="mt-3 flex flex-col gap-2">
                {informe.domicilios.map((d, i) => (
                  <li key={`${d.direccion}-${i}`} className={`rounded-lg border-2 p-3 ${domSel[i] ? 'border-petroleo bg-petroleo-suave' : 'border-borde'}`}>
                    <label className="flex cursor-pointer gap-3">
                      <input
                        type="checkbox"
                        className="mt-1 h-6 w-6 shrink-0 accent-[var(--petroleo)]"
                        checked={!!domSel[i]}
                        onChange={(e) => setDomSel((s) => s.map((v, j) => (j === i ? e.target.checked : v)))}
                        aria-label={`Agregar ${d.direccion}`}
                      />
                      <span className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="flex flex-wrap items-baseline gap-x-3">
                          <span className="text-sm font-bold text-tenue">{i + 1}º</span>
                          <span className="text-lg font-bold">{d.direccion}</span>
                          {d.seccion !== 'Más probable' && <span className="rounded border border-borde px-1 text-sm text-tenue">Domicilio {d.seccion.toLowerCase()}</span>}
                        </span>
                        {d.comuna && <span>{d.comuna}</span>}
                        {d.relacion && <span className="text-sm text-tenue">Relación con: {d.relacion}</span>}
                        <span className="mt-1 flex flex-col gap-1 md:flex-row md:gap-6">
                          <Estrellas valor={d.contactabilidad} etiqueta="Contactabilidad" />
                          <Estrellas valor={d.calidad} etiqueta="Calidad" />
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section>
            <h3 className="font-serif text-xl font-bold">Familiares y relacionados</h3>
            {informe.relacionados.length === 0 ? (
              <p className="mt-2 text-tenue">El informe no trae relacionados.</p>
            ) : (
              <ul className="mt-3 divide-y divide-borde rounded-lg border border-borde">
                {informe.relacionados.map((r, i) => (
                  <li key={`${r.rut}-${i}`} className="px-3 py-2">
                    <label className="flex cursor-pointer items-center gap-3">
                      <input
                        type="checkbox"
                        className="h-6 w-6 shrink-0 accent-[var(--petroleo)]"
                        checked={!!famSel[i]}
                        onChange={(e) => setFamSel((s) => s.map((v, j) => (j === i ? e.target.checked : v)))}
                        aria-label={`Guardar a ${r.nombre}`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="font-bold">{r.nombre}</span>
                        <span className="block text-sm text-tenue cifra">
                          {r.relacion}
                          {r.rut ? `, RUT ${r.rut}` : ''}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <p className="text-tenue">
            Se agregarán {plural(nDom, 'domicilio', 'domicilios')} a «Domicilios probables» y {plural(nFam, 'familiar', 'familiares')} a «Familiares del demandado».
            Después, guarde el retiro.
          </p>
        </div>
      )}
    </Ventana>
  )
}

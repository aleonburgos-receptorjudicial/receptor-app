// Ruta del día: las diligencias elegidas, en orden, para seguirlas en terreno desde el celular.
// Cada parada abre Maps o Waze (solo al tocar el botón), y se marca realizada o se desmarca.
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useNavigate } from 'react-router-dom'
import { db } from '../../../db/basedatos'
import { guardarAjustes, useAjustes } from '../../../db/ajustes'
import type { Causa } from '../../../db/tipos'
import { Boton, Casilla, SinDatos } from '../../../compartido/Controles'
import { useAviso, useConfirmar } from '../../../compartido/Dialogos'
import { IconoVolver } from '../../../compartido/Iconos'
import { fechaCL, hoyISO, plural } from '../../../utilidades/formato'
import { MarcaUrgente } from '../Etiquetas'
import { MarcarRealizada } from '../MarcarRealizada'
import { desmarcarRealizada } from '../servicioCausas'
import { direccionNavegable, tramosGoogleMaps, urlMaps, urlWaze } from './navegacion'

const enlaceBoton =
  'inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-lg border-2 border-borde bg-superficie px-3 font-bold text-tinta hover:border-petroleo'

export function PaginaRuta() {
  const ajustes = useAjustes()
  const avisar = useAviso()
  const confirmar = useConfirmar()
  const navegar = useNavigate()
  const [realizando, setRealizando] = useState<Causa | null>(null)
  const [ocultarHechas, setOcultarHechas] = useState(false)
  const ruta = ajustes.rutaDelDia

  const datos = useLiveQuery(async () => {
    const ids = ruta?.causaIds ?? []
    const [causas, clientes] = await Promise.all([db.causas.bulkGet(ids), db.clientes.toArray()])
    return { causas: causas.filter((c): c is Causa => !!c), clientes }
  }, [ruta?.causaIds.join(',')])

  if (!ruta || !ruta.causaIds.length) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="font-serif text-3xl font-bold md:text-4xl">Ruta del día</h1>
        <SinDatos
          titulo="No hay una ruta armada"
          texto="En Causas, toque «Hoja de ruta (PDF)», marque las diligencias que hará y toque «Usar como ruta del día»."
          accion={<Boton onClick={() => navegar('/causas?ruta=1')}>Elegir diligencias</Boton>}
        />
      </div>
    )
  }
  if (!datos) return <p className="text-tenue">Cargando…</p>

  const nombre = new Map(datos.clientes.map((c) => [c.id, c.nombre]))
  const paradas = datos.causas
  const hechas = paradas.filter((c) => c.estado !== 'Pendiente').length
  const pendientes = paradas.filter((c) => c.estado === 'Pendiente')
  const pct = paradas.length ? Math.round((hechas / paradas.length) * 100) : 0
  const direccionesPendientes = pendientes.map((c) => direccionNavegable(c, ajustes.comunaNavegacion)).filter((d): d is string => !!d)
  const tramos = tramosGoogleMaps(direccionesPendientes)

  const guardarOrden = (ids: number[]) => guardarAjustes({ rutaDelDia: { ...ruta, causaIds: ids } })
  const mover = (i: number, d: -1 | 1) => {
    const ids = paradas.map((c) => c.id!)
    const j = i + d
    if (j < 0 || j >= ids.length) return
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
    guardarOrden(ids)
  }
  const quitar = async (c: Causa) => {
    const ok = await confirmar({ titulo: 'Quitar de la ruta', mensaje: `¿Quitar ${c.rol} de la ruta del día? La causa no se borra.`, textoConfirmar: 'Quitar' })
    if (ok) guardarOrden(paradas.filter((x) => x.id !== c.id).map((x) => x.id!))
  }
  const desmarcar = async (c: Causa) => {
    const ok = await confirmar({ titulo: 'Desmarcar diligencia', mensaje: `${c.rol} volverá a quedar pendiente (se borran la fecha y el resultado de la diligencia).`, textoConfirmar: 'Desmarcar' })
    if (!ok) return
    await desmarcarRealizada(c.id!)
    avisar(`${c.rol} vuelve a estar pendiente`)
  }
  const terminar = async () => {
    const ok = await confirmar({
      titulo: 'Cerrar la ruta del día',
      mensaje: pendientes.length ? `Quedan ${plural(pendientes.length, 'diligencia pendiente', 'diligencias pendientes')}; siguen pendientes en Causas.` : 'Todas las diligencias están hechas.',
      textoConfirmar: 'Cerrar ruta',
    })
    if (!ok) return
    await guardarAjustes({ rutaDelDia: undefined })
    avisar('Ruta del día cerrada')
    navegar('/causas')
  }

  const visibles = ocultarHechas ? paradas.filter((c) => c.estado === 'Pendiente') : paradas

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link to="/causas" className="inline-flex min-h-12 items-center gap-1 font-bold text-petroleo">
          <IconoVolver /> Causas
        </Link>
        <h1 className="font-serif text-3xl font-bold md:text-4xl">Ruta del {fechaCL(ruta.fecha)}</h1>
        {ruta.fecha < hoyISO() && <p className="mt-1 font-bold text-naranja">Esta ruta es de un día anterior. Puede seguir usándola o cerrarla.</p>}
      </div>

      {/* Avance */}
      <section className="rounded-xl border border-borde bg-superficie p-4" aria-label="Avance de la ruta">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-2xl font-bold cifra">
            {hechas} de {paradas.length}
          </p>
          <p className="text-tenue">{pendientes.length ? `faltan ${plural(pendientes.length, 'parada', 'paradas')}` : 'ruta completa'}</p>
        </div>
        <div className="mt-2 h-3 overflow-hidden rounded-full bg-papel" role="progressbar" aria-valuemin={0} aria-valuemax={paradas.length} aria-valuenow={hechas} aria-label="Diligencias realizadas">
          <div className="h-full rounded-full bg-petroleo" style={{ width: `${pct}%` }} />
        </div>
        {tramos.length > 0 && (
          <div className="mt-4 flex flex-col gap-2">
            <p className="font-bold">Recorrido completo en Google Maps</p>
            <div className="flex flex-wrap gap-2">
              {tramos.map((t) => (
                <a key={t.desde} href={t.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center rounded-lg border-2 border-petroleo px-4 font-bold text-petroleo hover:bg-petroleo-suave">
                  {tramos.length === 1 ? `Abrir las ${t.hasta} paradas pendientes` : `Paradas pendientes ${t.desde} a ${t.hasta}`}
                </a>
              ))}
            </div>
            <p className="text-sm text-tenue">Google Maps permite hasta 9 paradas por recorrido, por eso se divide en tramos. Parte desde donde usted está.</p>
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <Casilla etiqueta="Ocultar las realizadas" checked={ocultarHechas} onChange={(e) => setOcultarHechas(e.target.checked)} />
          <div className="flex flex-wrap gap-2">
            <Boton variante="secundario" className="min-h-10 py-1" onClick={() => navegar('/causas?ruta=1')}>
              Agregar o quitar diligencias
            </Boton>
            <Boton variante="discreto" className="min-h-10 py-1" onClick={terminar}>
              Cerrar ruta
            </Boton>
          </div>
        </div>
      </section>

      {/* Paradas: línea de recorrido con números */}
      <ol className="relative flex flex-col" aria-label="Paradas de la ruta">
        {visibles.map((c) => {
          const i = paradas.indexOf(c)
          const hecha = c.estado !== 'Pendiente'
          const siguienteHecha = paradas[i + 1] && paradas[i + 1].estado !== 'Pendiente'
          const direccion = direccionNavegable(c, ajustes.comunaNavegacion)
          const ultima = c === visibles[visibles.length - 1]
          return (
            <li key={c.id} className="relative flex gap-3 pb-4">
              {/* Marcador y tramo de línea hacia la siguiente parada */}
              <div className="relative flex w-12 shrink-0 justify-center">
                {!ultima && <span className={`absolute top-12 bottom-0 w-1 ${hecha && siguienteHecha ? 'bg-petroleo' : 'bg-borde'}`} aria-hidden="true" />}
                <span
                  className={`relative z-10 flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold cifra ${hecha ? 'bg-petroleo text-sobre-petroleo' : 'border-4 border-petroleo bg-superficie text-petroleo'}`}
                  aria-label={hecha ? `Parada ${i + 1}, realizada` : `Parada ${i + 1}`}
                >
                  {hecha ? '✓' : i + 1}
                </span>
              </div>
              <article className={`min-w-0 flex-1 rounded-xl border p-4 ${hecha ? 'border-borde bg-papel' : 'border-borde bg-superficie'}`}>
                <p className={`text-lg font-bold ${hecha ? 'text-tenue line-through decoration-1' : ''}`}>{c.domicilio ?? 'Sin domicilio registrado'}</p>
                {c.sector && <p className="text-tenue">{c.sector}</p>}
                <p className="mt-1">{c.demandado ?? <span className="text-tenue">Demandado sin nombre</span>}</p>
                <p className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-petroleo-suave px-2 py-0.5 font-serif font-bold text-petroleo cifra">{c.rol}</span>
                  {c.urgente && <MarcaUrgente />}
                  <span className="text-sm text-tenue">{[c.tipoDiligencia, c.clienteId ? nombre.get(c.clienteId) : c.mandante].filter(Boolean).join(', ')}</span>
                </p>
                {hecha && (
                  <p className="mt-2 text-sm font-bold text-petroleo">
                    {c.estado === 'Realizada' ? `Realizada ${fechaCL(c.fechaDiligencia)}${c.resultado ? `, ${c.resultado.toLowerCase()}` : ''}${c.detalleResultado ? ` (${c.detalleResultado})` : ''}` : c.estado}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {direccion ? (
                    <>
                      <a className={enlaceBoton} href={urlMaps(direccion)} target="_blank" rel="noopener noreferrer" aria-label={`Abrir ${c.rol} en Google Maps`}>
                        Maps
                      </a>
                      <a className={enlaceBoton} href={urlWaze(direccion)} target="_blank" rel="noopener noreferrer" aria-label={`Abrir ${c.rol} en Waze`}>
                        Waze
                      </a>
                    </>
                  ) : (
                    <span className="flex min-h-12 flex-1 items-center text-sm text-tenue">Sin domicilio para navegar</span>
                  )}
                  {hecha ? (
                    <Boton variante="secundario" className="flex-1" onClick={() => desmarcar(c)}>
                      Desmarcar
                    </Boton>
                  ) : (
                    <Boton className="flex-1" onClick={() => setRealizando(c)}>
                      Realizada
                    </Boton>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <button type="button" className="min-h-10 text-sm font-bold text-tenue underline-offset-4 hover:underline" onClick={() => quitar(c)}>
                    Quitar de la ruta
                  </button>
                    <div className="flex items-center gap-1" aria-label="Cambiar el orden">
                      <button type="button" className="flex h-10 w-10 items-center justify-center rounded-md text-tenue hover:bg-petroleo-suave disabled:opacity-30" disabled={i === 0} onClick={() => mover(i, -1)} aria-label={`Subir ${c.rol}`}>
                        ↑
                      </button>
                      <button type="button" className="flex h-10 w-10 items-center justify-center rounded-md text-tenue hover:bg-petroleo-suave disabled:opacity-30" disabled={i === paradas.length - 1} onClick={() => mover(i, 1)} aria-label={`Bajar ${c.rol}`}>
                        ↓
                      </button>
                    </div>
                </div>
              </article>
            </li>
          )
        })}
      </ol>
      {visibles.length === 0 && <p className="text-center text-lg">Todas las paradas están realizadas.</p>}
      <p className="text-sm text-tenue">
        Privacidad: la dirección se envía a Google Maps o Waze solo cuando usted toca esos botones. La ruta y los resultados quedan guardados en este equipo.
      </p>

      <MarcarRealizada causa={realizando} alCerrar={() => setRealizando(null)} />
    </div>
  )
}

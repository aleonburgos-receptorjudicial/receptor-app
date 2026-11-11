// Lista de mandantes: agregar, cambiar el nombre (en todas las causas y retiros) y quitar los que no se usan.
import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/basedatos'
import { useAjustes } from '../../db/ajustes'
import { Boton, SinDatos } from '../../compartido/Controles'
import { useAviso, useConfirmar } from '../../compartido/Dialogos'
import { IconoBuscar } from '../../compartido/Iconos'
import { plural } from '../../utilidades/formato'
import { contiene, normalizar } from '../../utilidades/texto'
import { mandantesConUso, quitarMandante, recordarMandantes, renombrarMandante, type UsoMandante } from './servicioMandantes'

export function EditorMandantes() {
  const ajustes = useAjustes()
  const confirmar = useConfirmar()
  const avisar = useAviso()
  const [busqueda, setBusqueda] = useState('')
  const [nuevo, setNuevo] = useState('')
  const [editando, setEditando] = useState<string | null>(null)
  const [texto, setTexto] = useState('')
  const [error, setError] = useState('')

  const registros = useLiveQuery(async () => {
    const [causas, retiros] = await Promise.all([db.causas.toArray(), db.retiros.toArray()])
    return { causas, retiros }
  }, [])
  const lista = useMemo(
    () => (registros ? mandantesConUso(ajustes.mandantes, registros.causas, registros.retiros) : []),
    [registros, ajustes.mandantes],
  )
  if (!registros) return <p className="text-tenue">Cargando…</p>

  const visibles = lista.filter((m) => contiene(m.nombre, busqueda))
  const usos = (m: UsoMandante) => {
    const partes = [m.causas ? plural(m.causas, 'causa', 'causas') : '', m.retiros ? plural(m.retiros, 'retiro', 'retiros') : ''].filter(Boolean)
    return partes.length ? partes.join(', ') : 'Sin uso todavía'
  }

  const agregar = async () => {
    const t = nuevo.trim()
    if (!t) return
    if (lista.some((m) => normalizar(m.nombre) === normalizar(t))) return setError(`«${t}» ya está en la lista.`)
    await recordarMandantes([t])
    setNuevo('')
    setError('')
    avisar(`Mandante «${t}» agregado`)
  }

  const guardarNombre = async (m: UsoMandante) => {
    const t = texto.trim()
    if (!t) return setError('Escriba el nombre.')
    if (t === m.nombre) return setEditando(null)
    const otro = lista.find((x) => x !== m && normalizar(x.nombre) === normalizar(t))
    const total = m.causas + m.retiros
    const ok = await confirmar({
      titulo: otro ? 'Unir mandantes' : 'Cambiar nombre del mandante',
      textoConfirmar: otro ? 'Unir' : 'Cambiar nombre',
      mensaje: otro ? (
        <p>
          Ya existe «{otro.nombre}». Se unirán: {total ? `${plural(total, 'registro', 'registros')} de «${m.nombre}» pasarán` : '«' + m.nombre + '» pasará'} a llamarse «{t}».
        </p>
      ) : (
        <p>
          «{m.nombre}» pasará a llamarse «{t}»{total ? `, y se corregirá en ${usos(m).toLowerCase()}` : ''}.
        </p>
      ),
    })
    if (!ok) return
    const n = await renombrarMandante(m.nombre, t)
    setEditando(null)
    setError('')
    avisar(n ? `Nombre cambiado en ${plural(n, 'registro', 'registros')}` : 'Nombre cambiado')
  }

  const quitar = async (m: UsoMandante) => {
    const ok = await confirmar({ titulo: 'Quitar mandante', mensaje: `¿Quitar «${m.nombre}» de la lista?`, textoConfirmar: 'Quitar', peligro: true })
    if (!ok) return
    await quitarMandante(m.nombre)
    avisar(`«${m.nombre}» quitado de la lista`)
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-[70ch] text-tenue">
        Si cambia un nombre, se corrige en todas las causas y retiros que lo usan. Si lo cambia por uno que ya existe, ambos quedan unidos.
      </p>

      <div className="flex flex-col gap-2 rounded-xl border border-borde bg-superficie p-4 md:flex-row md:items-end">
        <label className="flex flex-1 flex-col gap-1">
          <span className="font-bold">Agregar mandante</span>
          <input
            className="min-h-12 rounded-lg border-2 border-borde bg-superficie px-3 focus:border-petroleo focus:outline-none"
            value={nuevo}
            placeholder="Ej.: BK, FORUM, TANNER"
            onChange={(e) => {
              setNuevo(e.target.value)
              setError('')
            }}
            onKeyDown={(e) => e.key === 'Enter' && agregar()}
          />
        </label>
        <Boton onClick={agregar}>Agregar mandante</Boton>
      </div>
      {error && (
        <p className="font-bold text-rojo" role="alert">
          {error}
        </p>
      )}

      {lista.length === 0 ? (
        <SinDatos titulo="Aún no hay mandantes" texto="Agregue uno arriba, o se agregarán solos al escribirlos en una causa o un retiro." />
      ) : (
        <>
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <label className="relative block md:w-[28rem]">
              <span className="sr-only">Buscar mandante</span>
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-tenue">
                <IconoBuscar />
              </span>
              <input
                type="search"
                className="min-h-12 w-full rounded-lg border-2 border-borde bg-superficie py-2 pl-11 pr-3 focus:border-petroleo focus:outline-none"
                placeholder="Buscar mandante"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </label>
            <p className="font-bold text-tenue">{plural(visibles.length, 'mandante', 'mandantes')}</p>
          </div>
          <ul className="divide-y divide-borde rounded-xl border border-borde bg-superficie">
            {visibles.map((m) => (
              <li key={m.nombre} className="flex flex-col gap-2 px-4 py-3 md:flex-row md:items-center">
                {editando === m.nombre ? (
                  <div className="flex flex-1 flex-wrap gap-2">
                    <input
                      className="min-h-12 min-w-0 flex-1 rounded-lg border-2 border-petroleo bg-superficie px-3"
                      value={texto}
                      autoFocus
                      aria-label={`Nuevo nombre para ${m.nombre}`}
                      onChange={(e) => setTexto(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') guardarNombre(m)
                        if (e.key === 'Escape') setEditando(null)
                      }}
                    />
                    <Boton onClick={() => guardarNombre(m)}>Guardar</Boton>
                    <Boton variante="secundario" onClick={() => setEditando(null)}>
                      Cancelar
                    </Boton>
                  </div>
                ) : (
                  <>
                    <div className="min-w-0 flex-1">
                      <p className="text-lg font-bold">{m.nombre}</p>
                      <p className="text-sm text-tenue">{usos(m)}</p>
                    </div>
                    <div className="flex gap-2">
                      <Boton
                        variante="secundario"
                        className="min-h-10 py-1"
                        aria-label={`Cambiar nombre de ${m.nombre}`}
                        onClick={() => {
                          setEditando(m.nombre)
                          setTexto(m.nombre)
                          setError('')
                        }}
                      >
                        Cambiar nombre
                      </Boton>
                      {m.causas + m.retiros === 0 && (
                        <Boton variante="discreto" className="min-h-10 py-1 text-rojo" aria-label={`Quitar ${m.nombre}`} onClick={() => quitar(m)}>
                          Quitar
                        </Boton>
                      )}
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

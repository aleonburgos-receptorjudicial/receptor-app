// Pantalla principal de Clientes / estudios jurídicos: lista con buscador.
import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { db } from '../../db/basedatos'
import { useAjustes } from '../../db/ajustes'
import { Boton, EncabezadoPagina, SinDatos } from '../../compartido/Controles'
import { IconoBuscar, IconoMas, IconoUnir } from '../../compartido/Iconos'
import { plural, pesos } from '../../utilidades/formato'
import { contiene } from '../../utilidades/texto'
import { EditorMandantes } from './EditorMandantes'
import { FormularioCliente } from './FormularioCliente'
import { FusionarClientes } from './FusionarClientes'
import { resumirCliente } from './servicioClientes'

export function PaginaClientes() {
  const navegar = useNavigate()
  const ajustes = useAjustes()
  const [busqueda, setBusqueda] = useState('')
  const [formAbierto, setFormAbierto] = useState(false)
  const [fusionAbierta, setFusionAbierta] = useState(false)
  // Pestañas: estudios jurídicos (clientes) o mandantes
  const [parametros, setParametros] = useSearchParams()
  const vista = parametros.get('vista') === 'mandantes' ? 'mandantes' : 'estudios'

  const datos = useLiveQuery(async () => {
    const [clientes, causas, retiros, boletas, pagos] = await Promise.all([
      db.clientes.orderBy('nombre').toArray(),
      db.causas.toArray(),
      db.retiros.toArray(),
      db.boletas.toArray(),
      db.pagos.toArray(),
    ])
    return { clientes, causas, retiros, boletas, pagos }
  }, [])

  const filas = useMemo(() => {
    if (!datos) return []
    return datos.clientes
      .filter((c) => contiene(c.nombre, busqueda) || contiene(c.rut, busqueda) || contiene(c.contacto, busqueda))
      .map((c) => ({ cliente: c, resumen: resumirCliente(c.id!, datos, ajustes.umbralesCausas) }))
  }, [datos, busqueda, ajustes.umbralesCausas])

  if (!datos) return <p className="text-tenue">Cargando…</p>

  const total = datos.clientes.length

  return (
    <div>
      <EncabezadoPagina
        titulo="Clientes"
        descripcion={vista === 'estudios' ? 'Estudios jurídicos y particulares que le encargan diligencias.' : 'Bancos, financieras y cooperativas por cuenta de quienes se hacen los encargos.'}
        acciones={
          vista === 'estudios' && (
          <>
            {total > 1 && (
              <Boton variante="secundario" icono={<IconoUnir />} onClick={() => setFusionAbierta(true)}>
                Fusionar clientes
              </Boton>
            )}
            <Boton icono={<IconoMas />} onClick={() => setFormAbierto(true)}>
              Nuevo cliente
            </Boton>
          </>
          )
        }
      />

      <div className="mb-6 flex gap-2 border-b-2 border-borde" role="tablist" aria-label="Tipo de cliente">
        {(
          [
            ['estudios', 'Estudios jurídicos'],
            ['mandantes', 'Mandantes'],
          ] as const
        ).map(([v, t]) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={vista === v}
            onClick={() => setParametros(v === 'mandantes' ? { vista: 'mandantes' } : {})}
            className={`-mb-0.5 min-h-12 border-b-4 px-4 text-lg font-bold ${vista === v ? 'border-petroleo text-petroleo' : 'border-transparent text-tenue hover:text-tinta'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {vista === 'mandantes' && <EditorMandantes />}

      {vista === 'estudios' && (total === 0 ? (
        <SinDatos
          titulo="Aún no hay clientes"
          texto="Agregue el primer estudio jurídico, o cargue datos de ejemplo desde Configuración para ver cómo funciona."
          accion={
            <Boton icono={<IconoMas />} onClick={() => setFormAbierto(true)}>
              Nuevo cliente
            </Boton>
          }
        />
      ) : (
        <>
          <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <label className="relative block md:w-[28rem]">
              <span className="sr-only">Buscar cliente</span>
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-tenue">
                <IconoBuscar />
              </span>
              <input
                type="search"
                className="min-h-12 w-full rounded-lg border-2 border-borde bg-superficie py-2 pl-11 pr-3 focus:border-petroleo focus:outline-none"
                placeholder="Buscar por nombre, RUT o contacto"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </label>
            <p className="font-bold text-tenue" aria-live="polite">
              {filas.length === total ? plural(total, 'cliente', 'clientes') : `${plural(filas.length, 'resultado', 'resultados')} de ${total}`}
            </p>
          </div>

          {filas.length === 0 ? (
            <SinDatos
              titulo="Ningún cliente coincide con la búsqueda"
              texto={`No hay clientes con «${busqueda}». Revise lo escrito o borre la búsqueda.`}
              accion={
                <Boton variante="secundario" onClick={() => setBusqueda('')}>
                  Borrar búsqueda
                </Boton>
              }
            />
          ) : (
            <>
              {/* Tabla (computador) */}
              <div className="hidden overflow-hidden rounded-xl border border-borde bg-superficie md:block">
                <table className="w-full text-left">
                  <thead className="border-b-2 border-borde bg-papel text-tenue">
                    <tr>
                      <th className="px-4 py-3">Cliente</th>
                      <th className="px-4 py-3">Contacto</th>
                      <th className="px-4 py-3 text-right">Pendientes</th>
                      <th className="px-4 py-3 text-right">Atrasadas</th>
                      <th className="px-4 py-3 text-right">Adeudado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-borde">
                    {filas.map(({ cliente: c, resumen: r }) => (
                      <tr key={c.id} className="cursor-pointer hover:bg-petroleo-suave" onClick={() => navegar(`/clientes/${c.id}`)}>
                        <td className="px-4 py-3">
                          <Link to={`/clientes/${c.id}`} className="font-bold text-petroleo underline-offset-4 hover:underline">
                            {c.nombre}
                          </Link>
                          {c.rut && <span className="block text-sm text-tenue cifra">{c.rut}</span>}
                        </td>
                        <td className="px-4 py-3">
                          {c.contacto ?? <span className="text-tenue">—</span>}
                          {c.telefono && <span className="block text-sm text-tenue">{c.telefono}</span>}
                        </td>
                        <td className="px-4 py-3 text-right cifra">{r.causasPendientes}</td>
                        <td className={`px-4 py-3 text-right cifra ${r.causasAtrasadas ? 'font-bold text-rojo' : ''}`}>{r.causasAtrasadas}</td>
                        <td className="px-4 py-3 text-right cifra">{r.adeudado ? pesos(r.adeudado) : <span className="text-tenue">—</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Tarjetas (celular) */}
              <ul className="flex flex-col gap-3 md:hidden">
                {filas.map(({ cliente: c, resumen: r }) => (
                  <li key={c.id}>
                    <Link to={`/clientes/${c.id}`} className="block rounded-xl border border-borde bg-superficie p-4 active:bg-petroleo-suave">
                      <p className="text-lg font-bold text-petroleo">{c.nombre}</p>
                      {c.contacto && <p className="text-tenue">{c.contacto}</p>}
                      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-lg bg-papel p-2">
                          <dt className="text-sm text-tenue">Pendientes</dt>
                          <dd className="text-xl font-bold cifra">{r.causasPendientes}</dd>
                        </div>
                        <div className={`rounded-lg p-2 ${r.causasAtrasadas ? 'bg-rojo-suave' : 'bg-papel'}`}>
                          <dt className="text-sm text-tenue">Atrasadas</dt>
                          <dd className={`text-xl font-bold cifra ${r.causasAtrasadas ? 'text-rojo' : ''}`}>{r.causasAtrasadas}</dd>
                        </div>
                        <div className="rounded-lg bg-papel p-2">
                          <dt className="text-sm text-tenue">Adeudado</dt>
                          <dd className="text-lg font-bold cifra">{pesos(r.adeudado)}</dd>
                        </div>
                      </dl>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      ))}

      <FormularioCliente abierta={formAbierto} alCerrar={() => setFormAbierto(false)} alGuardar={(id) => navegar(`/clientes/${id}`)} />
      <FusionarClientes abierta={fusionAbierta} clientes={datos.clientes} alCerrar={() => setFusionAbierta(false)} />
    </div>
  )
}

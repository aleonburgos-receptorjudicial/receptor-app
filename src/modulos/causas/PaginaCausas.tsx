// Pantalla de Causas (civiles, exhortos y otras): búsqueda, filtros, prioridades y acciones.
import { lazy, Suspense, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useSearchParams } from 'react-router-dom'
import { db } from '../../db/basedatos'
import { useAjustes } from '../../db/ajustes'
import { ESTADOS_CAUSA, type Causa } from '../../db/tipos'
import { Boton, EncabezadoPagina, SinDatos } from '../../compartido/Controles'
import { useAviso, useConfirmar } from '../../compartido/Dialogos'
import { IconoBasura, IconoBuscar, IconoEditar, IconoMas } from '../../compartido/Iconos'
import { Ventana } from '../../compartido/Ventana'
import { fechaCL, hoyISO, plural } from '../../utilidades/formato'
import { contiene, normalizar } from '../../utilidades/texto'
import { limpiarRut } from '../../utilidades/rut'
import { EtiquetaEstado, EtiquetaPrioridad, MarcaUrgente, PRIORIDADES } from './Etiquetas'
import { FormularioCausa } from './FormularioCausa'
import { HojaRuta } from './HojaRuta'
import { MarcarRealizada } from './MarcarRealizada'
import { diasDesdeEncargo, prioridadCausa, type NivelPrioridad } from './prioridad'
import { ResumenPorCliente } from './ResumenPorCliente'
import { eliminarCausa } from './servicioCausas'

interface Filtros {
  estado: string
  tipoCausa: string
  diligencia: string
  cliente: string
  prioridad: string
  desde: string
  hasta: string
}

const SIN_FILTROS: Filtros = { estado: '', tipoCausa: '', diligencia: '', cliente: '', prioridad: '', desde: '', hasta: '' }
const PASO = 100

// La herramienta de Excel es pesada: se carga solo cuando se importa o exporta
const ImportarCausas = lazy(() => import('./importar/ImportarCausas').then((m) => ({ default: m.ImportarCausas })))

const estiloFiltro = 'min-h-12 w-full rounded-lg border-2 border-borde bg-superficie px-2 focus:border-petroleo focus:outline-none'

function Filtro({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-sm font-bold text-tenue">
      {etiqueta}
      {children}
    </label>
  )
}

export function PaginaCausas() {
  const ajustes = useAjustes()
  const confirmar = useConfirmar()
  const avisar = useAviso()
  const [parametros] = useSearchParams()
  const [busqueda, setBusqueda] = useState('')
  const [filtros, setFiltros] = useState<Filtros>({ ...SIN_FILTROS, cliente: parametros.get('cliente') ?? '' })
  const [limite, setLimite] = useState(PASO)
  const [editando, setEditando] = useState<Causa | undefined>()
  const [formAbierto, setFormAbierto] = useState(false)
  const [realizando, setRealizando] = useState<Causa | null>(null)
  const [importando, setImportando] = useState(false)
  const [hojaRuta, setHojaRuta] = useState(false)
  const [resumen, setResumen] = useState(false)
  const [exportando, setExportando] = useState(false)
  const [verFiltros, setVerFiltros] = useState(false)

  const datos = useLiveQuery(async () => {
    const [causas, clientes] = await Promise.all([db.causas.toArray(), db.clientes.orderBy('nombre').toArray()])
    return { causas, clientes }
  }, [])

  const hoy = hoyISO()
  const nombreCliente = useMemo(() => new Map((datos?.clientes ?? []).map((c) => [c.id, c.nombre])), [datos])

  const filtradas = useMemo(() => {
    if (!datos) return []
    const q = busqueda.trim()
    const qRut = limpiarRut(q)
    return datos.causas
      .filter((c) => {
        if (q) {
          const coincide =
            contiene(c.rol, q) ||
            contiene(c.demandado, q) ||
            contiene(c.mandante, q) ||
            contiene(c.clienteId ? nombreCliente.get(c.clienteId) : '', q) ||
            (qRut.length >= 4 && !!c.rutDemandado && limpiarRut(c.rutDemandado).includes(qRut))
          if (!coincide) return false
        }
        if (filtros.estado && c.estado !== filtros.estado) return false
        if (filtros.tipoCausa && c.tipoCausa !== filtros.tipoCausa) return false
        if (filtros.diligencia && normalizar(c.tipoDiligencia) !== normalizar(filtros.diligencia)) return false
        if (filtros.cliente === 'sin' ? !!c.clienteId : filtros.cliente && String(c.clienteId) !== filtros.cliente) return false
        if (filtros.prioridad) {
          if (filtros.prioridad === 'urgente') {
            if (!c.urgente) return false
          } else if (prioridadCausa(c, ajustes.umbralesCausas, hoy) !== filtros.prioridad) return false
        }
        if (filtros.desde && c.fechaEncargo < filtros.desde) return false
        if (filtros.hasta && c.fechaEncargo > filtros.hasta) return false
        return true
      })
      .sort((a, b) => {
        // Pendientes primero (urgentes y más antiguas arriba); el resto, las más recientes arriba
        const pa = a.estado === 'Pendiente' ? 0 : 1
        const pb = b.estado === 'Pendiente' ? 0 : 1
        if (pa !== pb) return pa - pb
        if (pa === 0) return Number(!!b.urgente) - Number(!!a.urgente) || a.fechaEncargo.localeCompare(b.fechaEncargo)
        return (b.fechaDiligencia ?? b.fechaEncargo).localeCompare(a.fechaDiligencia ?? a.fechaEncargo)
      })
  }, [datos, busqueda, filtros, ajustes.umbralesCausas, hoy, nombreCliente])

  if (!datos) return <p className="text-tenue">Cargando…</p>

  const total = datos.causas.length
  const hayFiltros = !!busqueda || Object.values(filtros).some(Boolean)
  const pendientes = datos.causas.filter((c) => c.estado === 'Pendiente').length
  const atrasadas = datos.causas.filter((c) => prioridadCausa(c, ajustes.umbralesCausas, hoy) === 'maxima').length
  const diligencias = Array.from(new Set([...ajustes.tiposDiligencia, ...datos.causas.map((c) => c.tipoDiligencia).filter((x): x is string => !!x)]))

  const poner = (campo: keyof Filtros) => (e: { target: { value: string } }) => {
    setFiltros((f) => ({ ...f, [campo]: e.target.value }))
    setLimite(PASO)
  }
  const limpiar = () => {
    setFiltros(SIN_FILTROS)
    setBusqueda('')
  }

  const abrirNueva = () => {
    setEditando(undefined)
    setFormAbierto(true)
  }
  const abrirEdicion = (c: Causa) => {
    setEditando(c)
    setFormAbierto(true)
  }
  const borrar = async (c: Causa) => {
    const ok = await confirmar({
      titulo: 'Eliminar causa',
      peligro: true,
      textoConfirmar: 'Eliminar',
      mensaje: (
        <>
          <p>
            ¿Seguro que desea eliminar la causa <strong>{c.rol}</strong>
            {c.demandado ? ` (${c.demandado})` : ''}?
          </p>
          <p className="mt-2 text-tenue">Esta acción no se puede deshacer.</p>
        </>
      ),
    })
    if (!ok) return
    await eliminarCausa(c.id!)
    avisar(`Causa ${c.rol} eliminada`)
  }

  const exportar = async (todas: boolean) => {
    try {
      const { exportarCausas } = await import('./exportarCausas')
      exportarCausas(todas ? datos.causas : filtradas, datos.clientes, ajustes, todas ? undefined : `Causas filtradas ${fechaCL(hoy)}.xlsx`)
      avisar('Archivo Excel descargado')
    } catch {
      avisar('No se pudo crear el archivo Excel.', 'error')
    }
    setExportando(false)
  }

  const visibles = filtradas.slice(0, limite)

  const Acciones = ({ c, grande = false }: { c: Causa; grande?: boolean }) => (
    <div className={grande ? 'flex flex-wrap gap-2' : 'flex flex-wrap items-center justify-end gap-1'}>
      {c.estado === 'Pendiente' && (
        <Boton variante={grande ? 'principal' : 'secundario'} className={grande ? 'flex-1' : 'min-h-10 px-3 py-1 text-sm leading-tight'} onClick={() => setRealizando(c)}>
          Marcar realizada
        </Boton>
      )}
      <Boton variante="discreto" className={grande ? '' : 'min-h-10 px-2'} onClick={() => abrirEdicion(c)} aria-label={`Editar causa ${c.rol}`} icono={<IconoEditar />}>
        {grande ? 'Editar' : null}
      </Boton>
      <Boton variante="discreto" className={`text-rojo ${grande ? '' : 'min-h-10 px-2'}`} onClick={() => borrar(c)} aria-label={`Eliminar causa ${c.rol}`} icono={<IconoBasura />}>
        {grande ? 'Eliminar' : null}
      </Boton>
    </div>
  )

  return (
    <div>
      <EncabezadoPagina
        titulo="Causas"
        descripcion={
          total
            ? `${plural(pendientes, 'pendiente', 'pendientes')}${atrasadas ? `, ${plural(atrasadas, 'atrasada', 'atrasadas')} (más de ${ajustes.umbralesCausas.alta} días)` : ''}.`
            : 'Causas civiles, exhortos y otras diligencias encargadas.'
        }
        acciones={
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-end">
            <Boton variante="secundario" className="order-3 sm:order-none" onClick={() => setImportando(true)}>
              Importar Excel
            </Boton>
            {total > 0 && (
              <>
                <Boton variante="secundario" className="order-3 sm:order-none" onClick={() => setExportando(true)}>
                  Exportar Excel
                </Boton>
                <Boton variante="secundario" className="order-3 col-span-2 sm:order-none" onClick={() => setResumen(true)}>
                  Resumen por cliente
                </Boton>
                <Boton variante="secundario" onClick={() => setHojaRuta(true)} className="order-2 col-span-2 sm:order-none">
                  Hoja de ruta del día
                </Boton>
              </>
            )}
            <Boton icono={<IconoMas />} onClick={abrirNueva} className="order-1 col-span-2 sm:order-last">
              Nueva causa
            </Boton>
          </div>
        }
      />

      {total === 0 ? (
        <SinDatos
          titulo="Aún no hay causas"
          texto="Agregue una causa a mano o importe su planilla «Control de Encargos» o el Excel que le mandó un cliente."
          accion={
            <div className="flex flex-wrap justify-center gap-2">
              <Boton variante="secundario" onClick={() => setImportando(true)}>
                Importar Excel
              </Boton>
              <Boton icono={<IconoMas />} onClick={abrirNueva}>
                Nueva causa
              </Boton>
            </div>
          }
        />
      ) : (
        <>
          {/* Búsqueda y filtros */}
          <div className="mb-4 flex flex-col gap-3 rounded-xl border border-borde bg-superficie p-4">
            <label className="relative block">
              <span className="sr-only">Buscar causa</span>
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-tenue">
                <IconoBuscar />
              </span>
              <input
                type="search"
                className="min-h-12 w-full rounded-lg border-2 border-borde bg-superficie py-2 pl-11 pr-3 focus:border-petroleo focus:outline-none"
                placeholder="Buscar por ROL, demandado, RUT o cliente"
                value={busqueda}
                onChange={(e) => {
                  setBusqueda(e.target.value)
                  setLimite(PASO)
                }}
              />
            </label>
            <Boton variante="secundario" className="md:hidden" aria-expanded={verFiltros} onClick={() => setVerFiltros((v) => !v)}>
              {verFiltros ? 'Ocultar filtros' : `Filtros${Object.values(filtros).filter(Boolean).length ? ` (${Object.values(filtros).filter(Boolean).length} activos)` : ''}`}
            </Boton>
            <div className={`${verFiltros ? 'grid' : 'hidden'} grid-cols-2 gap-3 md:grid md:grid-cols-4 xl:grid-cols-7`}>
              <Filtro etiqueta="Estado">
                <select className={estiloFiltro} aria-label="Estado" value={filtros.estado} onChange={poner('estado')}>
                  <option value="">Todos</option>
                  {ESTADOS_CAUSA.map((e) => (
                    <option key={e}>{e}</option>
                  ))}
                </select>
              </Filtro>
              <Filtro etiqueta="Prioridad">
                <select className={estiloFiltro} aria-label="Prioridad" value={filtros.prioridad} onChange={poner('prioridad')}>
                  <option value="">Todas</option>
                  <option value="urgente">Urgentes</option>
                  {(Object.keys(PRIORIDADES) as NivelPrioridad[]).map((p) => (
                    <option key={p} value={p}>
                      {PRIORIDADES[p].texto}
                    </option>
                  ))}
                </select>
              </Filtro>
              <Filtro etiqueta="Tipo de causa">
                <select className={estiloFiltro} aria-label="Tipo de causa" value={filtros.tipoCausa} onChange={poner('tipoCausa')}>
                  <option value="">Todos</option>
                  {ajustes.tiposCausa.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </Filtro>
              <Filtro etiqueta="Diligencia">
                <select className={estiloFiltro} aria-label="Diligencia" value={filtros.diligencia} onChange={poner('diligencia')}>
                  <option value="">Todas</option>
                  {diligencias.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </Filtro>
              <Filtro etiqueta="Cliente">
                <select className={estiloFiltro} aria-label="Cliente" value={filtros.cliente} onChange={poner('cliente')}>
                  <option value="">Todos</option>
                  <option value="sin">Sin cliente</option>
                  {datos.clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </Filtro>
              <Filtro etiqueta="Encargo desde">
                <input type="date" className={estiloFiltro} aria-label="Encargo desde" value={filtros.desde} onChange={poner('desde')} />
              </Filtro>
              <Filtro etiqueta="Encargo hasta">
                <input type="date" className={estiloFiltro} aria-label="Encargo hasta" value={filtros.hasta} onChange={poner('hasta')} />
              </Filtro>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-bold" aria-live="polite">
                {hayFiltros ? `${plural(filtradas.length, 'causa', 'causas')} de ${total}` : plural(total, 'causa', 'causas')}
              </p>
              {hayFiltros && (
                <Boton variante="discreto" onClick={limpiar}>
                  Quitar filtros
                </Boton>
              )}
            </div>
          </div>

          {filtradas.length === 0 ? (
            <SinDatos
              titulo="Ninguna causa coincide"
              texto="No hay causas con esa búsqueda o filtros. Pruebe con menos filtros."
              accion={
                <Boton variante="secundario" onClick={limpiar}>
                  Quitar filtros
                </Boton>
              }
            />
          ) : (
            <>
              {/* Tabla (computador) */}
              <div className="hidden overflow-x-auto rounded-xl border border-borde bg-superficie lg:block">
                <table className="w-full text-left">
                  <thead className="border-b-2 border-borde bg-papel text-tenue">
                    <tr>
                      <th className="px-3 py-3">ROL y cliente</th>
                      <th className="px-3 py-3">Encargo</th>
                      <th className="px-3 py-3">Demandado</th>
                      <th className="px-3 py-3">Diligencia</th>
                      <th className="px-3 py-3">Estado</th>
                      <th className="w-36 px-3 py-3">
                        <span className="sr-only">Acciones</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-borde">
                    {visibles.map((c) => {
                      const nivel = prioridadCausa(c, ajustes.umbralesCausas, hoy)
                      return (
                        <tr key={c.id} className={`border-l-4 align-top ${nivel ? PRIORIDADES[nivel].borde : 'border-l-transparent'}`}>
                          <td className="px-3 py-3">
                            <button type="button" onClick={() => abrirEdicion(c)} className="whitespace-nowrap text-left font-serif text-lg font-bold text-petroleo cifra underline-offset-4 hover:underline">
                              {c.rol}
                            </button>
                            <span className="block text-sm text-tenue">
                              {c.tipoCausa}
                              {c.reencargo ? ', reencargo' : ''}
                            </span>
                            {c.urgente && <MarcaUrgente />}
                            <span className="mt-1 block min-w-36">{c.clienteId ? nombreCliente.get(c.clienteId) : <span className="text-tenue">Sin cliente</span>}</span>
                            {c.mandante && <span className="block text-sm text-tenue">{c.mandante}</span>}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            <span className="cifra">{fechaCL(c.fechaEncargo)}</span>
                            <span className="block">
                              <EtiquetaPrioridad nivel={nivel} dias={diasDesdeEncargo(c, hoy)} />
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            {c.demandado ?? <span className="text-tenue">—</span>}
                            {c.rutDemandado && <span className="block whitespace-nowrap text-sm text-tenue cifra">{c.rutDemandado}</span>}
                          </td>
                          <td className="px-3 py-3">
                            {c.tipoDiligencia ?? '—'}
                            {c.domicilio && <span className="block text-sm text-tenue">{c.domicilio}</span>}
                          </td>
                          <td className="px-3 py-3">
                            <EtiquetaEstado causa={c} />
                            {c.fechaDiligencia && <span className="block text-sm text-tenue cifra">{fechaCL(c.fechaDiligencia)}</span>}
                          </td>
                          <td className="px-3 py-3">
                            <Acciones c={c} />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Tarjetas (celular y tablet) */}
              <ul className="flex flex-col gap-3 lg:hidden">
                {visibles.map((c) => {
                  const nivel = prioridadCausa(c, ajustes.umbralesCausas, hoy)
                  return (
                    <li key={c.id} className={`rounded-xl border border-l-8 border-borde bg-superficie p-4 ${nivel ? PRIORIDADES[nivel].borde : ''}`}>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-serif text-xl font-bold cifra">{c.rol}</p>
                          <p className="text-sm text-tenue">
                            {c.tipoCausa} · encargo {fechaCL(c.fechaEncargo)}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {c.urgente && <MarcaUrgente />}
                          <EtiquetaPrioridad nivel={nivel} dias={diasDesdeEncargo(c, hoy)} />
                        </div>
                      </div>
                      <dl className="mt-3 flex flex-col gap-1">
                        <div>
                          <dt className="sr-only">Demandado</dt>
                          <dd className="text-lg font-bold">{c.demandado ?? <span className="font-normal text-tenue">Demandado sin nombre</span>}</dd>
                        </div>
                        <div>
                          <dt className="sr-only">Diligencia y domicilio</dt>
                          <dd>
                            {c.tipoDiligencia ?? 'Diligencia'}
                            {c.domicilio ? `, ${c.domicilio}` : ''}
                          </dd>
                        </div>
                        <div>
                          <dt className="sr-only">Cliente</dt>
                          <dd className="text-tenue">{c.clienteId ? nombreCliente.get(c.clienteId) : 'Sin cliente'}</dd>
                        </div>
                      </dl>
                      <div className="mt-3 border-t border-borde pt-3">
                        <EtiquetaEstado causa={c} />
                      </div>
                      <div className="mt-3">
                        <Acciones c={c} grande />
                      </div>
                    </li>
                  )
                })}
              </ul>

              {filtradas.length > limite && (
                <div className="mt-4 flex justify-center">
                  <Boton variante="secundario" onClick={() => setLimite((l) => l + PASO)}>
                    Mostrar más ({plural(filtradas.length - limite, 'causa restante', 'causas restantes')})
                  </Boton>
                </div>
              )}
            </>
          )}
        </>
      )}

      <FormularioCausa abierta={formAbierto} causa={editando} alCerrar={() => setFormAbierto(false)} />
      <MarcarRealizada causa={realizando} alCerrar={() => setRealizando(null)} />
      {importando && (
        <Suspense fallback={null}>
          <ImportarCausas abierta={importando} alCerrar={() => setImportando(false)} />
        </Suspense>
      )}
      <HojaRuta abierta={hojaRuta} causas={datos.causas} clientes={datos.clientes} ajustes={ajustes} alCerrar={() => setHojaRuta(false)} alMarcar={setRealizando} />
      <ResumenPorCliente
        abierta={resumen}
        causas={datos.causas}
        clientes={datos.clientes}
        ajustes={ajustes}
        alCerrar={() => setResumen(false)}
        alElegir={(id) => {
          setFiltros({ ...SIN_FILTROS, cliente: String(id) })
          setResumen(false)
        }}
      />
      <Ventana
        abierta={exportando}
        titulo="Exportar causas a Excel"
        alCerrar={() => setExportando(false)}
        ancho="max-w-lg"
        pie={
          <Boton variante="secundario" onClick={() => setExportando(false)}>
            Cancelar
          </Boton>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="text-tenue">El archivo usa los mismos encabezados de su planilla, así que se puede volver a importar.</p>
          {hayFiltros && (
            <Boton onClick={() => exportar(false)}>Exportar lo filtrado ({plural(filtradas.length, 'causa', 'causas')})</Boton>
          )}
          <Boton variante={hayFiltros ? 'secundario' : 'principal'} onClick={() => exportar(true)}>
            Exportar todo ({plural(total, 'causa', 'causas')})
          </Boton>
        </div>
      </Ventana>
    </div>
  )
}

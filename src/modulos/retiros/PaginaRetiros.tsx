// Pantalla de Retiros de vehículos: registro aparte de las causas, con vencimientos y alertas.
import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/basedatos'
import { useAjustes } from '../../db/ajustes'
import { ESTADOS_RETIRO, type Retiro } from '../../db/tipos'
import { Boton, EncabezadoPagina, SinDatos } from '../../compartido/Controles'
import { useAviso, useConfirmar } from '../../compartido/Dialogos'
import { IconoBasura, IconoBuscar, IconoEditar, IconoMas, IconoTelefono } from '../../compartido/Iconos'
import { Ventana } from '../../compartido/Ventana'
import { fechaCL, hoyISO, plural } from '../../utilidades/formato'
import { limpiarPatente } from '../../utilidades/patente'
import { limpiarRut } from '../../utilidades/rut'
import { contiene } from '../../utilidades/texto'
import { FormularioRetiro } from './FormularioRetiro'
import { BORDE_NIVEL, EstadoRetiro, EtiquetaVencimiento, NOMBRE_NIVEL, Placa } from './Piezas'
import { RegistrarRetiro } from './RegistrarRetiro'
import { eliminarRetiro, valorCampo } from './servicioRetiros'
import { diasRestantes, nivelVencimiento, retiroActivo, textoVencimiento, type NivelVencimiento } from './vencimiento'

const estiloFiltro = 'min-h-12 w-full rounded-lg border-2 border-borde bg-superficie px-2 focus:border-petroleo focus:outline-none'

export function PaginaRetiros() {
  const ajustes = useAjustes()
  const confirmar = useConfirmar()
  const avisar = useAviso()
  const [busqueda, setBusqueda] = useState('')
  const [estado, setEstado] = useState('activos')
  const [vence, setVence] = useState('')
  const [cliente, setCliente] = useState('')
  const [editando, setEditando] = useState<Retiro | undefined>()
  const [formAbierto, setFormAbierto] = useState(false)
  const [retirando, setRetirando] = useState<Retiro | null>(null)
  const [exportando, setExportando] = useState(false)

  const datos = useLiveQuery(async () => {
    const [retiros, clientes] = await Promise.all([db.retiros.toArray(), db.clientes.orderBy('nombre').toArray()])
    return { retiros, clientes }
  }, [])
  const hoy = hoyISO()
  const nombreCliente = useMemo(() => new Map((datos?.clientes ?? []).map((c) => [c.id, c.nombre])), [datos])

  const filtrados = useMemo(() => {
    if (!datos) return []
    const q = busqueda.trim()
    const qPat = limpiarPatente(q)
    const qRut = limpiarRut(q)
    return datos.retiros
      .filter((r) => {
        if (q) {
          const coincide =
            contiene(r.rol, q) ||
            contiene(r.deudor, q) ||
            contiene(r.marca, q) ||
            contiene(r.modelo, q) ||
            contiene(r.clienteId ? nombreCliente.get(r.clienteId) : '', q) ||
            contiene(r.mandante, q) ||
            contiene(r.tribunal, q) ||
            contiene(r.martilleroNombre, q) ||
            (qPat.length >= 3 && !!r.patente && limpiarPatente(r.patente).includes(qPat)) ||
            (qRut.length >= 4 && !!r.rutDeudor && limpiarRut(r.rutDeudor).includes(qRut))
          if (!coincide) return false
        }
        if (estado === 'activos' ? !retiroActivo(r) : estado && r.estado !== estado) return false
        if (vence === 'atencion') {
          if (!retiroActivo(r) || diasRestantes(r, hoy) > 7) return false
        } else if (vence && nivelVencimiento(r, ajustes.umbralesRetiros, hoy) !== vence) return false
        if (cliente && String(r.clienteId ?? '') !== cliente) return false
        return true
      })
      .sort((a, b) => {
        // En curso primero, los que vencen antes arriba
        const aa = retiroActivo(a) ? 0 : 1
        const bb = retiroActivo(b) ? 0 : 1
        if (aa !== bb) return aa - bb
        return aa === 0 ? a.fechaVencimiento.localeCompare(b.fechaVencimiento) : b.fechaEncargo.localeCompare(a.fechaEncargo)
      })
  }, [datos, busqueda, estado, vence, cliente, ajustes.umbralesRetiros, hoy, nombreCliente])

  if (!datos) return <p className="text-tenue">Cargando…</p>

  const total = datos.retiros.length
  const activos = datos.retiros.filter(retiroActivo)
  const vencidos = activos.filter((r) => diasRestantes(r, hoy) < 0).length
  const porVencer = activos.filter((r) => diasRestantes(r, hoy) >= 0 && diasRestantes(r, hoy) <= 7).length
  // Oficios que requieren atención: vencidos o que vencen en los próximos 7 días
  const urgentes = activos.filter((r) => diasRestantes(r, hoy) <= 7).sort((a, b) => a.fechaVencimiento.localeCompare(b.fechaVencimiento))
  const hayFiltros = !!busqueda || estado !== 'activos' || !!vence || !!cliente
  // En las tarjetas, "Más datos" muestra los campos propios y estos de fábrica que no tienen lugar fijo
  const MAS_DATOS = new Set(['revisionTecnica', 'permisoCirculacion', 'observaciones', 'lugarRetiro', 'custodio'])
  const camposExtra = ajustes.camposRetiro.filter((c) => c.visible && (!c.base || MAS_DATOS.has(c.clave)))

  const abrirNuevo = () => {
    setEditando(undefined)
    setFormAbierto(true)
  }
  const abrirEdicion = (r: Retiro) => {
    setEditando(r)
    setFormAbierto(true)
  }
  const borrar = async (r: Retiro) => {
    const ok = await confirmar({
      titulo: 'Eliminar retiro',
      peligro: true,
      textoConfirmar: 'Eliminar',
      mensaje: (
        <>
          <p>
            ¿Seguro que desea eliminar el retiro del ROL <strong>{r.rol}</strong>
            {r.patente ? `, patente ${r.patente}` : ''}?
          </p>
          <p className="mt-2 text-tenue">Esta acción no se puede deshacer.</p>
        </>
      ),
    })
    if (!ok) return
    await eliminarRetiro(r.id!)
    avisar('Retiro eliminado')
  }
  const limpiar = () => {
    setBusqueda('')
    setEstado('activos')
    setVence('')
    setCliente('')
  }
  const exportar = async (todos: boolean) => {
    try {
      const { exportarRetiros } = await import('./exportarRetiros')
      exportarRetiros(todos ? datos.retiros : filtrados, datos.clientes, ajustes.camposRetiro, todos ? undefined : `Retiros filtrados ${fechaCL(hoy)}.xlsx`)
      avisar('Archivo Excel descargado')
    } catch {
      avisar('No se pudo crear el archivo Excel.', 'error')
    }
    setExportando(false)
  }

  const Acciones = ({ r, grande = false }: { r: Retiro; grande?: boolean }) => (
    <div className={grande ? 'flex flex-wrap gap-2' : 'flex flex-wrap items-center justify-end gap-1'}>
      {retiroActivo(r) && (
        <Boton variante={grande ? 'principal' : 'secundario'} className={grande ? 'flex-1' : 'min-h-10 px-3 py-1 text-sm leading-tight'} onClick={() => setRetirando(r)}>
          Registrar retiro
        </Boton>
      )}
      <Boton variante="discreto" className={grande ? '' : 'min-h-10 px-2'} onClick={() => abrirEdicion(r)} aria-label={`Editar retiro ${r.rol}`} icono={<IconoEditar />}>
        {grande ? 'Editar' : null}
      </Boton>
      <Boton variante="discreto" className={`text-rojo ${grande ? '' : 'min-h-10 px-2'}`} onClick={() => borrar(r)} aria-label={`Eliminar retiro ${r.rol}`} icono={<IconoBasura />}>
        {grande ? 'Eliminar' : null}
      </Boton>
    </div>
  )

  const vehiculo = (r: Retiro) => [r.marca, r.modelo, r.anio, r.color].filter(Boolean).join(' ')
  // Fechas con guion que no se corta al final de la línea
  const fechaFija = (iso?: string) => (iso ? ` ${fechaCL(iso).replace(/-/g, '\u2011')}` : '')
  const fuerzaPublica = (r: Retiro) =>
    r.fuerzaPublicaConcedida ? `Fuerza pública concedida${fechaFija(r.fechaFuerzaConcedida)}` : r.fuerzaPublicaSolicitada ? `Fuerza pública solicitada${fechaFija(r.fechaFuerzaSolicitada)}` : null

  return (
    <div>
      <EncabezadoPagina
        titulo="Retiros de vehículos"
        descripcion={
          total
            ? `${plural(activos.length, 'retiro en curso', 'retiros en curso')}${vencidos ? `, ${plural(vencidos, 'vencido', 'vencidos')}` : ''}${porVencer ? `, ${plural(porVencer, 'vence', 'vencen')} en los próximos 7 días` : ''}.`
            : 'Encargos de retiro de vehículos, con su fecha de vencimiento.'
        }
        acciones={
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-end">
            {total > 0 && (
              <Boton variante="secundario" className="order-2 col-span-2 sm:order-none" onClick={() => setExportando(true)}>
                Exportar Excel
              </Boton>
            )}
            <Boton icono={<IconoMas />} className="order-1 col-span-2 sm:order-last" onClick={abrirNuevo}>
              Nuevo retiro
            </Boton>
          </div>
        }
      />

      {total === 0 ? (
        <SinDatos
          titulo="Aún no hay retiros de vehículos"
          texto="Ingrese el primer retiro con su fecha de vencimiento. La app le avisará cuando esté por vencer."
          accion={
            <Boton icono={<IconoMas />} onClick={abrirNuevo}>
              Nuevo retiro
            </Boton>
          }
        />
      ) : (
        <>
          {urgentes.length > 0 && (
            <section className="mb-4 rounded-xl border-2 border-rojo bg-rojo-suave p-4" aria-labelledby="titulo-alerta-oficios">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id="titulo-alerta-oficios" className="font-serif text-xl font-bold">
                  {vencidos ? `${plural(vencidos, 'oficio vencido', 'oficios vencidos')}` : ''}
                  {vencidos && porVencer ? ' y ' : ''}
                  {porVencer ? `${plural(porVencer, 'oficio vence', 'oficios vencen')} esta semana` : ''}
                </h2>
                <Boton
                  variante="secundario"
                  className="min-h-10 py-1 text-sm"
                  onClick={() => {
                    setEstado('activos')
                    setVence('atencion')
                  }}
                >
                  Ver solo estos
                </Boton>
              </div>
              <ul className="mt-3 flex flex-col gap-2">
                {urgentes.slice(0, 6).map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => abrirEdicion(r)}
                      className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-superficie px-3 py-2 text-left hover:ring-2 hover:ring-petroleo"
                    >
                      <span className={`min-w-36 font-bold ${diasRestantes(r, hoy) < 0 ? 'text-rojo' : 'text-naranja'}`}>{textoVencimiento(diasRestantes(r, hoy))}</span>
                      <span className="font-serif font-bold cifra">{r.rol}</span>
                      <span>{r.patente ?? 'Sin patente'}</span>
                      <span className="text-tenue">{r.deudor ?? ''}</span>
                    </button>
                  </li>
                ))}
              </ul>
              {urgentes.length > 6 && <p className="mt-2 text-tenue">y {plural(urgentes.length - 6, 'otro', 'otros')} más.</p>}
            </section>
          )}

          <div className="mb-4 flex flex-col gap-3 rounded-xl border border-borde bg-superficie p-4">
            <label className="relative block">
              <span className="sr-only">Buscar retiro</span>
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-tenue">
                <IconoBuscar />
              </span>
              <input
                type="search"
                className="min-h-12 w-full rounded-lg border-2 border-borde bg-superficie py-2 pl-11 pr-3 focus:border-petroleo focus:outline-none"
                placeholder="Buscar por patente, ROL, demandado, RUT, mandante o martillero"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="flex flex-col gap-1 text-sm font-bold text-tenue">
                Estado
                <select aria-label="Estado" className={estiloFiltro} value={estado} onChange={(e) => setEstado(e.target.value)}>
                  <option value="activos">En curso (pendientes y en búsqueda)</option>
                  <option value="">Todos</option>
                  {ESTADOS_RETIRO.map((e) => (
                    <option key={e}>{e}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm font-bold text-tenue">
                Vencimiento
                <select aria-label="Vencimiento" className={estiloFiltro} value={vence} onChange={(e) => setVence(e.target.value)}>
                  <option value="">Todos</option>
                  <option value="atencion">Vencidos y por vencer (7 días)</option>
                  {(['vencido', 'naranja', 'amarillo', 'verde'] as NivelVencimiento[]).map((n) => (
                    <option key={n} value={n}>
                      {NOMBRE_NIVEL[n]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm font-bold text-tenue">
                Cliente
                <select aria-label="Cliente" className={estiloFiltro} value={cliente} onChange={(e) => setCliente(e.target.value)}>
                  <option value="">Todos</option>
                  {datos.clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-bold" aria-live="polite">
                {plural(filtrados.length, 'retiro', 'retiros')} de {total}
              </p>
              {hayFiltros && (
                <Boton variante="discreto" onClick={limpiar}>
                  Quitar filtros
                </Boton>
              )}
            </div>
          </div>

          {filtrados.length === 0 ? (
            <SinDatos
              titulo="Ningún retiro coincide"
              texto={estado === 'activos' && !busqueda ? 'No hay retiros en curso. Elija «Todos» en Estado para ver los terminados.' : 'Pruebe con menos filtros o revise la búsqueda.'}
              accion={
                <Boton variante="secundario" onClick={() => (estado === 'activos' && !busqueda ? setEstado('') : limpiar())}>
                  {estado === 'activos' && !busqueda ? 'Ver todos' : 'Quitar filtros'}
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
                      <th className="px-3 py-3">Vehículo</th>
                      <th className="px-3 py-3">ROL y cliente</th>
                      <th className="px-3 py-3">Demandado y martillero</th>
                      <th className="px-3 py-3">Oficio</th>
                      <th className="px-3 py-3">Estado</th>
                      <th className="w-36 px-3 py-3">
                        <span className="sr-only">Acciones</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-borde">
                    {filtrados.map((r) => {
                      const nivel = nivelVencimiento(r, ajustes.umbralesRetiros, hoy)
                      return (
                        <tr key={r.id} className={`border-l-4 align-top ${BORDE_NIVEL(nivel)}`}>
                          <td className="px-3 py-3">
                            <button type="button" onClick={() => abrirEdicion(r)} className="text-left" aria-label={`Abrir retiro ${r.rol}`}>
                              <Placa patente={r.patente} />
                            </button>
                            <span className="mt-1 block text-sm text-tenue">{vehiculo(r) || 'Sin datos del vehículo'}</span>
                          </td>
                          <td className="px-3 py-3">
                            <span className="whitespace-nowrap font-serif text-lg font-bold cifra">{r.rol}</span>
                            <span className="block">{r.clienteId ? nombreCliente.get(r.clienteId) : <span className="text-tenue">Sin cliente</span>}</span>
                            {r.mandante && <span className="block text-sm text-tenue">{r.mandante}</span>}
                          </td>
                          <td className="px-3 py-3">
                            {r.deudor ?? <span className="text-tenue">—</span>}
                            {r.rutDeudor && <span className="block whitespace-nowrap text-sm text-tenue cifra">{r.rutDeudor}</span>}
                            {r.martilleroNombre && (
                              <span className="mt-1 block text-sm">
                                Martillero: {r.martilleroNombre}
                                {r.martilleroTelefono && <span className="block whitespace-nowrap text-tenue">{r.martilleroTelefono}</span>}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            <span className="cifra">Vence {fechaCL(r.fechaVencimiento)}</span>
                            <span className="block">
                              <EtiquetaVencimiento nivel={nivel} dias={diasRestantes(r, hoy)} />
                            </span>
                            {r.fechaEmision && <span className="block text-sm text-tenue cifra">Emitido {fechaCL(r.fechaEmision)}</span>}
                            <span className="block max-w-48 whitespace-normal text-sm text-tenue">{r.tribunal}</span>
                          </td>
                          <td className="px-3 py-3">
                            <EstadoRetiro estado={r.estado} />
                            {fuerzaPublica(r) && <span className="mt-1 block text-sm text-tenue">{fuerzaPublica(r)}</span>}
                            {r.estado === 'Retirado' && r.fechaRetiro && (
                              <span className="mt-1 block text-sm text-tenue">
                                Retirado {fechaFija(r.fechaRetiro)}
                                {r.horaRetiro ? ` a las ${r.horaRetiro}` : ''}
                                {r.lugarRetiro ? `, en ${r.lugarRetiro}` : ''}
                                {r.custodio ? `. Depósito: ${r.custodio}` : ''}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            <Acciones r={r} />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Tarjetas (celular y tablet) */}
              <ul className="flex flex-col gap-3 lg:hidden">
                {filtrados.map((r) => {
                  const nivel = nivelVencimiento(r, ajustes.umbralesRetiros, hoy)
                  const conExtras = camposExtra.filter((c) => {
                    const v = valorCampo(r, c)
                    return v !== undefined && v !== null && v !== ''
                  })
                  return (
                    <li key={r.id} className={`rounded-xl border border-l-8 border-borde bg-superficie p-4 ${BORDE_NIVEL(nivel)}`}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <Placa patente={r.patente} />
                        <div className="flex flex-col items-end gap-1">
                          <EtiquetaVencimiento nivel={nivel} dias={diasRestantes(r, hoy)} />
                          <span className="text-sm text-tenue cifra">Vence {fechaCL(r.fechaVencimiento)}</span>
                        </div>
                      </div>
                      <p className="mt-2 text-tenue">{vehiculo(r) || 'Sin datos del vehículo'}</p>
                      <p className="mt-2 font-serif text-lg font-bold cifra">ROL {r.rol}</p>
                      <p className="text-lg font-bold">{r.deudor ?? <span className="font-normal text-tenue">Demandado sin nombre</span>}</p>
                      {r.direccion && <p className="whitespace-pre-line">{r.direccion}</p>}
                      <p className="text-tenue">
                        {[r.clienteId ? nombreCliente.get(r.clienteId) : 'Sin cliente', r.mandante].filter(Boolean).join(', ')}
                      </p>
                      {r.fechaEmision && <p className="text-sm text-tenue cifra">Oficio emitido {fechaCL(r.fechaEmision)}</p>}
                      {r.martilleroNombre && (
                        <div className="mt-2 rounded-lg bg-papel p-2">
                          <p>Martillero: {r.martilleroNombre}</p>
                          {r.martilleroTelefono && (
                            <a href={`tel:${r.martilleroTelefono.replace(/[^\d+]/g, '')}`} className="inline-flex min-h-12 items-center gap-2 font-bold text-petroleo">
                              <IconoTelefono /> {r.martilleroTelefono}
                            </a>
                          )}
                          {r.martilleroDireccion && <p className="text-sm text-tenue">{r.martilleroDireccion}</p>}
                        </div>
                      )}
                      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-borde pt-3">
                        <EstadoRetiro estado={r.estado} />
                        {fuerzaPublica(r) && <span className="text-sm text-tenue">{fuerzaPublica(r)}</span>}
                      </div>
                      {conExtras.length > 0 && (
                        <details className="mt-3">
                          <summary className="min-h-10 cursor-pointer py-2 font-bold text-petroleo">Más datos ({conExtras.length})</summary>
                          <dl className="grid grid-cols-1 gap-1">
                            {conExtras.map((c) => {
                              const v = valorCampo(r, c)
                              return (
                                <div key={c.clave}>
                                  <dt className="inline text-tenue">{c.etiqueta}: </dt>
                                  <dd className="inline">{v === true ? 'Sí' : v === false ? 'No' : c.tipo === 'fecha' ? fechaCL(String(v)) : String(v)}</dd>
                                </div>
                              )
                            })}
                          </dl>
                        </details>
                      )}
                      <div className="mt-3">
                        <Acciones r={r} grande />
                      </div>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </>
      )}

      <FormularioRetiro abierta={formAbierto} retiro={editando} alCerrar={() => setFormAbierto(false)} />
      <RegistrarRetiro retiro={retirando} alCerrar={() => setRetirando(null)} />
      <Ventana
        abierta={exportando}
        titulo="Exportar retiros a Excel"
        alCerrar={() => setExportando(false)}
        ancho="max-w-lg"
        pie={
          <Boton variante="secundario" onClick={() => setExportando(false)}>
            Cancelar
          </Boton>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="text-tenue">El archivo usa los campos y nombres que configuró para el formulario de retiros.</p>
          {hayFiltros && <Boton onClick={() => exportar(false)}>Exportar lo filtrado ({plural(filtrados.length, 'retiro', 'retiros')})</Boton>}
          <Boton variante={hayFiltros ? 'secundario' : 'principal'} onClick={() => exportar(true)}>
            Exportar todo ({plural(total, 'retiro', 'retiros')})
          </Boton>
        </div>
      </Ventana>
    </div>
  )
}

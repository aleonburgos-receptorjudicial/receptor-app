// Pantalla de Boletas de honorarios: indicadores, antigüedad de la deuda, emisión mensual, avance por cliente y lista.
// Las boletas ANULADAS solo aparecen en la pestaña "Anuladas": no entran en totales, gráficos, alertas ni barras.
import { lazy, Suspense, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/basedatos'
import { useAjustes } from '../../db/ajustes'
import type { Boleta } from '../../db/tipos'
import { Boton, EncabezadoPagina, Seccion, SinDatos } from '../../compartido/Controles'
import { useAviso, useConfirmar } from '../../compartido/Dialogos'
import { IconoBasura, IconoBuscar, IconoEditar, IconoMas } from '../../compartido/Iconos'
import { fechaCL, hoyISO, plural, pesos } from '../../utilidades/formato'
import { limpiarRut } from '../../utilidades/rut'
import { contiene, normalizar } from '../../utilidades/texto'
import { antiguedadDeuda, diasDesdeEmision, emisionMensual, indicadores, nivelBoleta, porCliente, saldoBoleta, vigente, type NivelBoleta } from './calculos'
import { FormularioBoleta } from './FormularioBoleta'
import { RecordatorioCobro } from './RecordatorioCobro'
import { RegistrarPago } from './RegistrarPago'
import { eliminarBoleta } from './servicioBoletas'

// Partes pesadas que se cargan solo cuando se necesitan
const GraficoEmision = lazy(() => import('./GraficoEmision'))
const ImportarBoletas = lazy(() => import('./importar/ImportarBoletas').then((m) => ({ default: m.ImportarBoletas })))

type Pestana = 'vigentes' | 'impagas' | 'pagadas' | 'anuladas'

const ESTILO_NIVEL: Record<NivelBoleta, string> = {
  reciente: 'text-tenue',
  primera: 'bg-amarillo-suave text-amarillo',
  segunda: 'bg-naranja-suave text-naranja',
  tercera: 'bg-rojo-suave text-rojo',
}
const BARRA_NIVEL: Record<NivelBoleta, string> = { reciente: 'bg-verde', primera: 'bg-amarillo', segunda: 'bg-naranja', tercera: 'bg-rojo' }
const estiloFiltro = 'min-h-12 w-full rounded-lg border-2 border-borde bg-superficie px-2 focus:border-petroleo focus:outline-none'

export function PaginaBoletas() {
  const ajustes = useAjustes()
  const confirmar = useConfirmar()
  const avisar = useAviso()
  const [pestana, setPestana] = useState<Pestana>('vigentes')
  const [busqueda, setBusqueda] = useState('')
  const [cliente, setCliente] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [formAbierto, setFormAbierto] = useState(false)
  const [editando, setEditando] = useState<Boleta | undefined>()
  const [pagando, setPagando] = useState<Boleta | null>(null)
  const [importando, setImportando] = useState(false)
  const [recordatorio, setRecordatorio] = useState<{ clave: string; nombre: string; clienteId?: number } | null>(null)
  const [todosClientes, setTodosClientes] = useState(false)

  const datos = useLiveQuery(async () => {
    const [boletas, pagos, clientes] = await Promise.all([db.boletas.toArray(), db.pagos.toArray(), db.clientes.orderBy('nombre').toArray()])
    return { boletas, pagos, clientes }
  }, [])
  const hoy = hoyISO()
  const u = ajustes.umbralesBoletas

  const calc = useMemo(() => {
    if (!datos) return null
    const { boletas, pagos, clientes } = datos
    return {
      ind: indicadores(boletas, pagos, u, hoy),
      tramos: antiguedadDeuda(boletas, pagos, u, hoy),
      meses: emisionMensual(boletas, pagos, 12, hoy),
      clientes: porCliente(boletas, pagos, clientes, hoy),
    }
  }, [datos, u, hoy])

  const claveCliente = (b: Boleta) => (b.clienteId ? `id${b.clienteId}` : `n${normalizar(b.nombreCliente ?? 'sin cliente')}`)

  const lista = useMemo(() => {
    if (!datos) return []
    const q = busqueda.trim()
    const qRut = limpiarRut(q)
    const nombre = new Map(datos.clientes.map((c) => [c.id, c.nombre]))
    return datos.boletas
      .filter((b) => {
        const saldo = saldoBoleta(b, datos.pagos)
        if (pestana === 'anuladas' ? vigente(b) : !vigente(b)) return false
        if (pestana === 'impagas' && saldo <= 0) return false
        if (pestana === 'pagadas' && (b.estado !== 'Pagada' || saldo > 0)) return false
        if (q) {
          const coincide =
            String(b.numero).includes(q.replace(/\D/g, '') || '§') ||
            contiene(b.nombreCliente, q) ||
            contiene(b.clienteId ? nombre.get(b.clienteId) : '', q) ||
            contiene(b.glosa, q) ||
            (qRut.length >= 4 && !!b.rutCliente && limpiarRut(b.rutCliente).includes(qRut))
          if (!coincide) return false
        }
        if (cliente && claveCliente(b) !== cliente) return false
        if (desde && b.fechaEmision < desde) return false
        if (hasta && b.fechaEmision > hasta) return false
        return true
      })
      .sort((a, b) => b.fechaEmision.localeCompare(a.fechaEmision) || b.numero - a.numero)
  }, [datos, pestana, busqueda, cliente, desde, hasta])

  if (!datos || !calc) return <p className="text-tenue">Cargando…</p>

  const { ind, tramos, meses } = calc
  const total = datos.boletas.length
  const nombreCliente = (b: Boleta) => (b.clienteId ? datos.clientes.find((c) => c.id === b.clienteId)?.nombre : undefined) ?? b.nombreCliente ?? 'Sin cliente'
  const hayFiltros = !!busqueda || !!cliente || !!desde || !!hasta
  const limpiar = () => {
    setBusqueda('')
    setCliente('')
    setDesde('')
    setHasta('')
  }
  const cuentas = {
    vigentes: ind.vigentes,
    impagas: ind.impagas,
    pagadas: datos.boletas.filter((b) => b.estado === 'Pagada').length,
    anuladas: ind.anuladas,
  }

  const abrirNueva = () => {
    setEditando(undefined)
    setFormAbierto(true)
  }
  const abrirEdicion = (b: Boleta) => {
    setEditando(b)
    setFormAbierto(true)
  }
  const borrar = async (b: Boleta) => {
    const ok = await confirmar({
      titulo: 'Eliminar boleta',
      peligro: true,
      textoConfirmar: 'Eliminar',
      mensaje: (
        <>
          <p>
            ¿Seguro que desea eliminar la boleta <strong>N° {b.numero}</strong> de {nombreCliente(b)}?
          </p>
          <p className="mt-2">Se eliminan también sus pagos registrados. Si la boleta fue anulada en el SII, es mejor marcarla como «Anulada».</p>
          <p className="mt-2 text-tenue">Esta acción no se puede deshacer.</p>
        </>
      ),
    })
    if (!ok) return
    await eliminarBoleta(b.id!)
    avisar(`Boleta N° ${b.numero} eliminada`)
  }
  const exportar = async () => {
    try {
      const { exportarBoletas } = await import('./exportarBoletas')
      exportarBoletas(datos.boletas, datos.pagos, datos.clientes)
      avisar('Archivo Excel descargado')
    } catch {
      avisar('No se pudo crear el archivo Excel.', 'error')
    }
  }
  const verCliente = (clave: string) => {
    setPestana('vigentes')
    setCliente(clave)
    document.getElementById('lista-boletas')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const tarjetas = [
    { t: 'Total vigente', v: pesos(ind.totalVigente), d: plural(ind.vigentes, 'boleta', 'boletas') },
    { t: 'Cobrado', v: pesos(ind.cobrado) },
    { t: 'Por cobrar', v: pesos(ind.porCobrar), d: plural(ind.impagas, 'boleta impaga', 'boletas impagas'), fuerte: true },
    { t: `En alerta (${u.primera} días o más)`, v: pesos(ind.enAlerta), alerta: ind.enAlerta > 0 },
    { t: 'Retenciones', v: pesos(ind.retenciones) },
    { t: 'Tiempo promedio de pago', v: ind.promedioPago === null ? '—' : plural(ind.promedioPago, 'día', 'días'), d: ind.promedioPago === null ? 'Aún sin pagos registrados' : undefined },
  ]
  const maxTramo = Math.max(1, ...tramos.map((t) => t.monto))
  const clientesConBoletas = calc.clientes
  const clientesVisibles = todosClientes ? clientesConBoletas : clientesConBoletas.slice(0, 6)

  const Acciones = ({ b, grande = false }: { b: Boleta; grande?: boolean }) => (
    <div className={grande ? 'flex flex-wrap gap-2' : 'flex flex-wrap items-center justify-end gap-1'}>
      {saldoBoleta(b, datos.pagos) > 0 && (
        <Boton variante={grande ? 'principal' : 'secundario'} className={grande ? 'flex-1' : 'min-h-10 px-3 py-1 text-sm leading-tight'} onClick={() => setPagando(b)}>
          Registrar pago
        </Boton>
      )}
      <Boton variante="discreto" className={grande ? '' : 'min-h-10 px-2'} onClick={() => abrirEdicion(b)} aria-label={`Abrir boleta ${b.numero}`} icono={<IconoEditar />}>
        {grande ? 'Abrir' : null}
      </Boton>
      <Boton variante="discreto" className={`text-rojo ${grande ? '' : 'min-h-10 px-2'}`} onClick={() => borrar(b)} aria-label={`Eliminar boleta ${b.numero}`} icono={<IconoBasura />}>
        {grande ? 'Eliminar' : null}
      </Boton>
    </div>
  )

  const Dias = ({ b }: { b: Boleta }) => {
    const nivel = nivelBoleta(b, datos.pagos, u, hoy)
    if (!nivel) return null
    return <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-sm font-bold cifra ${ESTILO_NIVEL[nivel]}`}>Impaga hace {plural(diasDesdeEmision(b, hoy), 'día', 'días')}</span>
  }
  const Estado = ({ b }: { b: Boleta }) => {
    const saldo = saldoBoleta(b, datos.pagos)
    if (b.estado === 'Anulada') return <span className="rounded-md bg-rojo px-2 py-0.5 text-sm font-bold text-papel">Anulada{b.fechaAnulacion ? ` ${fechaCL(b.fechaAnulacion)}` : ''}</span>
    if (saldo <= 0) return <span className="rounded-md border border-borde bg-papel px-2 py-0.5 text-sm font-bold">Pagada</span>
    if (saldo < b.montoCobrar) return <span className="rounded-md border border-petroleo px-2 py-0.5 text-sm font-bold text-petroleo">Abono parcial</span>
    return <span className="rounded-md border border-petroleo px-2 py-0.5 text-sm font-bold text-petroleo">Pendiente</span>
  }

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoPagina
        titulo="Boletas de honorarios"
        descripcion={total ? `${pesos(ind.porCobrar)} por cobrar en ${plural(ind.impagas, 'boleta', 'boletas')}.` : 'Boletas emitidas, pagos y cobranza.'}
        acciones={
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-end">
            <Boton variante="secundario" className="order-2 sm:order-none" onClick={() => setImportando(true)}>
              Importar del SII
            </Boton>
            {total > 0 && (
              <Boton variante="secundario" className="order-2 sm:order-none" onClick={exportar}>
                Exportar Excel
              </Boton>
            )}
            <Boton icono={<IconoMas />} className="order-1 col-span-2 sm:order-last" onClick={abrirNueva}>
              Nueva boleta
            </Boton>
          </div>
        }
      />

      {total === 0 ? (
        <SinDatos
          titulo="Aún no hay boletas"
          texto="Importe los PDF de sus boletas o el informe mensual de boletas emitidas del SII, o agregue una boleta a mano."
          accion={
            <div className="flex flex-wrap justify-center gap-2">
              <Boton variante="secundario" onClick={() => setImportando(true)}>
                Importar del SII
              </Boton>
              <Boton icono={<IconoMas />} onClick={abrirNueva}>
                Nueva boleta
              </Boton>
            </div>
          }
        />
      ) : (
        <>
          {/* Indicadores */}
          <dl className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {tarjetas.map((t) => (
              <div key={t.t} className={`rounded-xl border p-4 ${t.alerta ? 'border-rojo bg-rojo-suave' : 'border-borde bg-superficie'}`}>
                <dt className="text-sm text-tenue">{t.t}</dt>
                <dd className={`mt-1 text-xl font-bold cifra md:text-2xl ${t.alerta ? 'text-rojo' : t.fuerte ? 'text-petroleo' : ''}`}>{t.v}</dd>
                {t.d && <dd className="text-sm text-tenue">{t.d}</dd>}
              </div>
            ))}
          </dl>

          <div className="grid gap-6 lg:grid-cols-2">
            <Seccion titulo="Antigüedad de la deuda">
              <p className="mb-3 text-sm text-tenue">Lo que falta por cobrar, según los días desde la emisión.</p>
              <ul className="flex flex-col gap-3">
                {tramos.map((t) => (
                  <li key={t.tramo}>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-bold">{t.tramo}</span>
                      <span className="cifra">
                        <strong>{pesos(t.monto)}</strong> <span className="text-sm text-tenue">({plural(t.cantidad, 'boleta', 'boletas')})</span>
                      </span>
                    </div>
                    <div className="mt-1 h-3 overflow-hidden rounded-full bg-papel" aria-hidden="true">
                      <div className={`h-full rounded-full ${BARRA_NIVEL[t.nivel]}`} style={{ width: `${(t.monto / maxTramo) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </Seccion>
            <Seccion titulo="Emisión mensual">
              <Suspense fallback={<p className="py-8 text-center text-tenue">Cargando gráfico…</p>}>
                <GraficoEmision datos={meses} />
              </Suspense>
            </Seccion>
          </div>

          {clientesConBoletas.length > 0 && (
            <Seccion titulo="Avance de pago por cliente">
              <p className="mb-3 text-sm text-tenue">Toque un cliente para ver sus boletas. Los clientes que más deben aparecen primero.</p>
              <ul className="flex flex-col divide-y divide-borde">
                {clientesVisibles.map((c) => {
                  const totalC = c.pagado + c.adeudado
                  const pct = totalC ? Math.round((c.pagado / totalC) * 100) : 0
                  return (
                    <li key={c.clave} className="flex flex-col gap-2 py-3 md:flex-row md:items-center md:gap-4">
                      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => verCliente(c.clave)} aria-label={`Ver boletas de ${c.nombre}`}>
                        <span className="flex flex-wrap items-baseline justify-between gap-2">
                          <span className="font-bold text-petroleo underline-offset-4 hover:underline">{c.nombre}</span>
                          <span className="text-sm cifra">
                            {c.adeudado > 0 ? (
                              <>
                                Debe <strong>{pesos(c.adeudado)}</strong> ({plural(c.impagas, 'boleta', 'boletas')}, la más antigua de {plural(c.masAntigua, 'día', 'días')})
                              </>
                            ) : (
                              'Al día'
                            )}
                          </span>
                        </span>
                        <span className="mt-1 flex h-3 overflow-hidden rounded-full bg-papel" role="img" aria-label={`Pagado ${pct} %`}>
                          <span className="h-full bg-serie-pagado" style={{ width: `${pct}%` }} />
                          {c.adeudado > 0 && <span className="h-full border-l-2 border-superficie bg-serie-cobrar" style={{ width: `${100 - pct}%` }} />}
                        </span>
                        <span className="mt-1 block text-sm text-tenue cifra">
                          Pagado {pesos(c.pagado)} ({pct} %)
                          {c.promedioPago !== null ? `. Paga en promedio en ${plural(c.promedioPago, 'día', 'días')}` : ''}
                        </span>
                      </button>
                      {c.adeudado > 0 && (
                        <Boton variante="secundario" className="min-h-10 shrink-0 py-1 text-sm" onClick={() => setRecordatorio({ clave: c.clave, nombre: c.nombre, clienteId: c.clienteId })}>
                          Recordatorio de cobro
                        </Boton>
                      )}
                    </li>
                  )
                })}
              </ul>
              {clientesConBoletas.length > 6 && (
                <Boton variante="discreto" className="mt-2" onClick={() => setTodosClientes((v) => !v)}>
                  {todosClientes ? 'Ver menos' : `Ver los ${clientesConBoletas.length} clientes`}
                </Boton>
              )}
            </Seccion>
          )}

          {/* Lista */}
          <section id="lista-boletas" className="flex scroll-mt-4 flex-col gap-4" aria-label="Lista de boletas">
            <div className="flex flex-wrap gap-2 border-b-2 border-borde" role="tablist" aria-label="Qué boletas mostrar">
              {(
                [
                  ['vigentes', 'Todas vigentes'],
                  ['impagas', 'Impagas'],
                  ['pagadas', 'Pagadas'],
                  ['anuladas', 'Anuladas'],
                ] as [Pestana, string][]
              ).map(([p, t]) => (
                <button
                  key={p}
                  type="button"
                  role="tab"
                  aria-selected={pestana === p}
                  onClick={() => setPestana(p)}
                  className={`-mb-0.5 min-h-12 border-b-4 px-3 font-bold ${pestana === p ? 'border-petroleo text-petroleo' : 'border-transparent text-tenue hover:text-tinta'}`}
                >
                  {t} <span className="cifra">({cuentas[p]})</span>
                </button>
              ))}
            </div>
            {pestana === 'anuladas' && <p className="text-tenue">Las boletas anuladas se guardan como registro, pero no se suman en ningún total, gráfico ni alerta.</p>}

            <div className="flex flex-col gap-3 rounded-xl border border-borde bg-superficie p-4">
              <label className="relative block">
                <span className="sr-only">Buscar boleta</span>
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-tenue">
                  <IconoBuscar />
                </span>
                <input
                  type="search"
                  className="min-h-12 w-full rounded-lg border-2 border-borde bg-superficie py-2 pl-11 pr-3 focus:border-petroleo focus:outline-none"
                  placeholder="Buscar por N° de boleta, cliente, RUT o glosa"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                />
              </label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="flex flex-col gap-1 text-sm font-bold text-tenue">
                  Cliente
                  <select aria-label="Cliente" className={estiloFiltro} value={cliente} onChange={(e) => setCliente(e.target.value)}>
                    <option value="">Todos</option>
                    {clientesConBoletas.map((c) => (
                      <option key={c.clave} value={c.clave}>
                        {c.nombre}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm font-bold text-tenue">
                  Emitida desde
                  <input aria-label="Emitida desde" type="date" className={estiloFiltro} value={desde} onChange={(e) => setDesde(e.target.value)} />
                </label>
                <label className="flex flex-col gap-1 text-sm font-bold text-tenue">
                  Emitida hasta
                  <input aria-label="Emitida hasta" type="date" className={estiloFiltro} value={hasta} onChange={(e) => setHasta(e.target.value)} />
                </label>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-bold" aria-live="polite">
                  {plural(lista.length, 'boleta', 'boletas')}
                  {lista.length > 0 && pestana !== 'anuladas' ? `, ${pesos(lista.reduce((s, b) => s + saldoBoleta(b, datos.pagos), 0))} por cobrar` : ''}
                </p>
                {hayFiltros && (
                  <Boton variante="discreto" onClick={limpiar}>
                    Quitar filtros
                  </Boton>
                )}
              </div>
            </div>

            {lista.length === 0 ? (
              <SinDatos
                titulo={pestana === 'anuladas' && !hayFiltros ? 'No hay boletas anuladas' : 'Ninguna boleta coincide'}
                texto={hayFiltros ? 'Pruebe con menos filtros o revise la búsqueda.' : 'No hay boletas en esta pestaña.'}
                accion={
                  hayFiltros ? (
                    <Boton variante="secundario" onClick={limpiar}>
                      Quitar filtros
                    </Boton>
                  ) : undefined
                }
              />
            ) : (
              <>
                <div className="hidden overflow-x-auto rounded-xl border border-borde bg-superficie lg:block">
                  <table className="w-full text-left">
                    <thead className="border-b-2 border-borde bg-papel text-tenue">
                      <tr>
                        <th className="px-3 py-3">N° y emisión</th>
                        <th className="px-3 py-3">Cliente</th>
                        <th className="px-3 py-3">Glosa</th>
                        <th className="px-3 py-3 text-right">A cobrar</th>
                        <th className="px-3 py-3">Estado</th>
                        <th className="w-36 px-3 py-3">
                          <span className="sr-only">Acciones</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-borde">
                      {lista.map((b) => {
                        const saldo = saldoBoleta(b, datos.pagos)
                        return (
                          <tr key={b.id} className="align-top">
                            <td className="px-3 py-3">
                              <button type="button" onClick={() => abrirEdicion(b)} className="font-serif text-lg font-bold text-petroleo cifra underline-offset-4 hover:underline">
                                N° {b.numero}
                              </button>
                              <span className="block text-sm text-tenue cifra">{fechaCL(b.fechaEmision)}</span>
                              <Dias b={b} />
                            </td>
                            <td className="px-3 py-3">
                              {nombreCliente(b)}
                              {b.rutCliente && <span className="block whitespace-nowrap text-sm text-tenue cifra">{b.rutCliente}</span>}
                            </td>
                            <td className="max-w-72 px-3 py-3">
                              <span className="line-clamp-2">{b.glosa ?? <span className="text-tenue">—</span>}</span>
                            </td>
                            <td className="px-3 py-3 text-right whitespace-nowrap cifra">
                              <span className="font-bold">{pesos(b.montoCobrar)}</span>
                              <span className="block text-sm text-tenue">Bruto {pesos(b.bruto)}</span>
                              {saldo > 0 && saldo < b.montoCobrar && <span className="block text-sm font-bold text-petroleo">Falta {pesos(saldo)}</span>}
                            </td>
                            <td className="px-3 py-3">
                              <Estado b={b} />
                            </td>
                            <td className="px-3 py-3">
                              <Acciones b={b} />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <ul className="flex flex-col gap-3 lg:hidden">
                  {lista.map((b) => {
                    const saldo = saldoBoleta(b, datos.pagos)
                    return (
                      <li key={b.id} className="rounded-xl border border-borde bg-superficie p-4">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="font-serif text-xl font-bold cifra">N° {b.numero}</p>
                            <p className="text-sm text-tenue cifra">Emitida {fechaCL(b.fechaEmision)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xl font-bold cifra">{pesos(saldo > 0 ? saldo : b.montoCobrar)}</p>
                            <p className="text-sm text-tenue">{saldo > 0 ? (saldo < b.montoCobrar ? `falta, de ${pesos(b.montoCobrar)}` : 'por cobrar') : 'monto a cobrar'}</p>
                          </div>
                        </div>
                        <p className="mt-2 text-lg font-bold">{nombreCliente(b)}</p>
                        {b.glosa && <p className="line-clamp-2 text-tenue">{b.glosa}</p>}
                        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-borde pt-3">
                          <Estado b={b} />
                          <Dias b={b} />
                        </div>
                        <div className="mt-3">
                          <Acciones b={b} grande />
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </>
            )}
          </section>
        </>
      )}

      <FormularioBoleta abierta={formAbierto} boleta={editando} alCerrar={() => setFormAbierto(false)} alRegistrarPago={setPagando} />
      <RegistrarPago boleta={pagando} alCerrar={() => setPagando(null)} />
      {importando && (
        <Suspense fallback={null}>
          <ImportarBoletas abierta={importando} alCerrar={() => setImportando(false)} />
        </Suspense>
      )}
      <RecordatorioCobro
        nombre={recordatorio?.nombre ?? null}
        cliente={recordatorio?.clienteId ? datos.clientes.find((c) => c.id === recordatorio.clienteId) : undefined}
        boletas={recordatorio ? datos.boletas.filter((b) => vigente(b) && claveCliente(b) === recordatorio.clave) : []}
        pagos={datos.pagos}
        alCerrar={() => setRecordatorio(null)}
      />
    </div>
  )
}

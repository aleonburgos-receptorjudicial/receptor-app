// Inicio: "¿qué tengo que hacer hoy?". Contadores, alertas ordenadas por urgencia, accesos rápidos y gráficos pequeños.
import { lazy, Suspense, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db } from '../../db/basedatos'
import { useAjustes } from '../../db/ajustes'
import { Seccion } from '../../compartido/Controles'
import { IconoBoleta, IconoCausas, IconoMas, IconoVehiculo } from '../../compartido/Iconos'
import { hoyISO, plural, pesos } from '../../utilidades/formato'
import { indicadores } from '../boletas/calculos'
import { prioridadCausa } from '../causas/prioridad'
import { diasSinRespaldo } from '../configuracion/respaldo'
import { alertasRetiro, retiroActivo } from '../retiros/vencimiento'
import { calcularAlertas, type NivelAlerta } from './alertas'

const GraficoRealizadas = lazy(() => import('./GraficoRealizadas'))

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const ESTILO: Record<NivelAlerta, { borde: string; marca: string; texto: string }> = {
  critica: { borde: 'border-l-rojo', marca: 'bg-rojo text-papel', texto: 'Urgente' },
  alta: { borde: 'border-l-naranja', marca: 'bg-naranja-suave text-naranja', texto: 'Pronto' },
  media: { borde: 'border-l-amarillo', marca: 'bg-amarillo-suave text-amarillo', texto: 'Atención' },
}

export function PaginaInicio() {
  const ajustes = useAjustes()
  const hoy = hoyISO()
  const datos = useLiveQuery(async () => {
    const [causas, retiros, boletas, pagos] = await Promise.all([db.causas.toArray(), db.retiros.toArray(), db.boletas.toArray(), db.pagos.toArray()])
    return { causas, retiros, boletas, pagos }
  }, [])

  const calc = useMemo(() => {
    if (!datos) return null
    const activos = datos.retiros.filter(retiroActivo)
    const al = activos.map((r) => alertasRetiro(r, ajustes, hoy))
    // Causas realizadas por mes (últimos 6 meses)
    const [a, m] = hoy.split('-').map(Number)
    const meses = Array.from({ length: 6 }, (_, i) => {
      const f = new Date(a, m - 6 + i, 1)
      return { clave: `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}`, mes: MESES[f.getMonth()], realizadas: 0 }
    })
    for (const c of datos.causas) {
      if (c.estado !== 'Realizada' || !c.fechaDiligencia) continue
      const fila = meses.find((x) => x.clave === c.fechaDiligencia!.slice(0, 7))
      if (fila) fila.realizadas++
    }
    return {
      pendientes: datos.causas.filter((c) => c.estado === 'Pendiente').length,
      atrasadas: datos.causas.filter((c) => prioridadCausa(c, ajustes.umbralesCausas, hoy) === 'maxima').length,
      porVencer: al.filter((x) => x.renovar).length,
      vencidos: al.filter((x) => x.vencido).length,
      ind: indicadores(datos.boletas, datos.pagos, ajustes.umbralesBoletas, hoy),
      alertas: calcularAlertas(datos, ajustes, diasSinRespaldo(ajustes.ultimoRespaldo), hoy),
      meses,
    }
  }, [datos, ajustes, hoy])

  if (!datos || !calc) return <p className="text-tenue">Cargando…</p>

  const fechaLarga = new Date().toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })
  const ruta = ajustes.rutaDelDia
  const rutaHechas = ruta ? datos.causas.filter((c) => ruta.causaIds.includes(c.id!) && c.estado !== 'Pendiente').length : 0
  const vacia = !datos.causas.length && !datos.retiros.length && !datos.boletas.length
  const { ind } = calc
  const totalCobro = ind.cobrado + ind.porCobrar
  const pctCobrado = totalCobro ? Math.round((ind.cobrado / totalCobro) * 100) : 0

  const contadores = [
    { t: 'Causas pendientes', v: String(calc.pendientes), a: '/causas?estado=Pendiente' },
    { t: `Causas con más de ${ajustes.umbralesCausas.alta} días`, v: String(calc.atrasadas), a: '/causas?prioridad=maxima', alerta: calc.atrasadas > 0 },
    { t: `Oficios por vencer (${ajustes.diasAvisoRenovacion} días)`, v: String(calc.porVencer), a: '/retiros?vence=renovar', aviso: calc.porVencer > 0 },
    { t: 'Oficios vencidos', v: String(calc.vencidos), a: '/retiros?vence=vencido', alerta: calc.vencidos > 0 },
    { t: 'Boletas impagas', v: String(ind.impagas), a: '/boletas?pestana=impagas' },
    { t: 'Por cobrar', v: pesos(ind.porCobrar), a: '/boletas?pestana=impagas', fuerte: true },
  ]
  const accesos = [
    { t: 'Nueva causa', a: '/causas?nueva=1', i: <IconoCausas /> },
    { t: 'Nuevo retiro', a: '/retiros?nuevo=1', i: <IconoVehiculo /> },
    { t: 'Nueva boleta', a: '/boletas?nueva=1', i: <IconoBoleta /> },
    { t: 'Importar Excel', a: '/causas?importar=1', i: <IconoMas /> },
  ]

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-serif text-3xl font-bold md:text-4xl">Hoy, {fechaLarga}</h1>
        <p className="mt-1 text-tenue">
          {vacia
            ? 'Bienvenida. Empiece agregando una causa, un retiro o una boleta, o cargue datos de ejemplo en Ajustes para conocer la app.'
            : calc.alertas.length
              ? `${plural(calc.alertas.length, 'asunto necesita', 'asuntos necesitan')} su atención.`
              : 'No hay alertas pendientes.'}
        </p>
      </header>

      {/* Accesos rápidos */}
      <nav aria-label="Accesos rápidos" className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {accesos.map((x) => (
          <Link key={x.t} to={x.a} className="flex min-h-14 items-center justify-center gap-2 rounded-xl border-2 border-petroleo bg-superficie px-3 font-bold text-petroleo hover:bg-petroleo-suave">
            {x.i}
            {x.t}
          </Link>
        ))}
      </nav>

      {ruta && ruta.causaIds.length > 0 && (
        <Link to="/ruta" className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-petroleo p-4 text-sobre-petroleo">
          <span>
            <span className="block font-serif text-xl font-bold">Ruta del día</span>
            <span className="cifra">
              {rutaHechas} de {ruta.causaIds.length} paradas realizadas
            </span>
          </span>
          <span className="rounded-lg bg-sobre-petroleo px-4 py-2 font-bold text-petroleo">Continuar la ruta</span>
        </Link>
      )}

      {/* Contadores */}
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {contadores.map((c) => (
          <Link key={c.t} to={c.a} className={`rounded-xl border p-4 hover:ring-2 hover:ring-petroleo ${c.alerta ? 'border-rojo bg-rojo-suave' : c.aviso ? 'border-naranja bg-naranja-suave' : 'border-borde bg-superficie'}`}>
            <dt className="text-sm text-tenue">{c.t}</dt>
            <dd className={`mt-1 text-2xl font-bold cifra ${c.alerta ? 'text-rojo' : c.aviso ? 'text-naranja' : c.fuerte ? 'text-petroleo' : ''}`}>{c.v}</dd>
          </Link>
        ))}
      </dl>

      {/* Alertas */}
      <Seccion titulo="Qué atender primero">
        {calc.alertas.length === 0 ? (
          <p className="text-lg">Todo al día: no hay causas atrasadas, oficios por vencer ni boletas impagas antiguas.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {calc.alertas.map((al) => (
              <li key={al.clave}>
                <Link to={al.ruta} className={`flex flex-col gap-1 rounded-lg border border-l-8 border-borde bg-superficie px-4 py-3 hover:bg-petroleo-suave md:flex-row md:items-center md:gap-4 ${ESTILO[al.nivel].borde}`}>
                  <span className="flex shrink-0 items-center gap-2 md:w-44">
                    <span className={`rounded-md px-2 py-0.5 text-sm font-bold ${ESTILO[al.nivel].marca}`}>{ESTILO[al.nivel].texto}</span>
                    <span className="text-sm text-tenue">{al.modulo}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold">{al.titulo}</span>
                    <span className="block text-tenue">{al.detalle}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Seccion>

      {/* Gráficos pequeños */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Seccion titulo="Causas realizadas por mes">
          <Suspense fallback={<p className="py-8 text-center text-tenue">Cargando gráfico…</p>}>
            <GraficoRealizadas datos={calc.meses} />
          </Suspense>
        </Seccion>
        <Seccion titulo="Cobrado y por cobrar">
          {totalCobro === 0 ? (
            <p className="py-8 text-center text-tenue">Aún no hay boletas vigentes.</p>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex h-6 overflow-hidden rounded-full bg-papel" role="img" aria-label={`Cobrado ${pctCobrado} %, por cobrar ${100 - pctCobrado} %`}>
                <span className="h-full bg-serie-pagado" style={{ width: `${pctCobrado}%` }} />
                {ind.porCobrar > 0 && <span className="h-full border-l-2 border-superficie bg-serie-cobrar" style={{ width: `${100 - pctCobrado}%` }} />}
              </div>
              <dl className="grid grid-cols-2 gap-3">
                <div>
                  <dt className="flex items-center gap-2 text-tenue">
                    <span className="inline-block h-3 w-3 rounded-sm bg-serie-pagado" aria-hidden="true" /> Cobrado
                  </dt>
                  <dd className="text-xl font-bold cifra">{pesos(ind.cobrado)}</dd>
                  <dd className="text-sm text-tenue">{pctCobrado} % de lo emitido</dd>
                </div>
                <div>
                  <dt className="flex items-center gap-2 text-tenue">
                    <span className="inline-block h-3 w-3 rounded-sm bg-serie-cobrar" aria-hidden="true" /> Por cobrar
                  </dt>
                  <dd className="text-xl font-bold cifra">{pesos(ind.porCobrar)}</dd>
                  <dd className="text-sm text-tenue">{plural(ind.impagas, 'boleta impaga', 'boletas impagas')}</dd>
                </div>
              </dl>
              <Link to="/boletas" className="self-start font-bold text-petroleo underline-offset-4 hover:underline">
                Ver boletas
              </Link>
            </div>
          )}
        </Seccion>
      </div>
    </div>
  )
}

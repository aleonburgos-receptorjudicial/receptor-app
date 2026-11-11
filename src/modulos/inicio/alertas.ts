// Alertas de toda la app, ordenadas por urgencia: crítica (rojo), alta (naranja) y media (amarillo).
// Las causas y boletas se agrupan (pueden ser muchas); los retiros vencidos o por vencer van uno por uno.
import type { Ajustes, Boleta, Causa, Pago, Retiro } from '../../db/tipos'
import { hoyISO, plural, pesos } from '../../utilidades/formato'
import { diasDesdeEmision, nivelBoleta, saldoBoleta, vigente } from '../boletas/calculos'
import { diasDesdeEncargo, prioridadCausa } from '../causas/prioridad'
import { alertasRetiro, diasDesdeEncargo as diasEncargoRetiro, diasRestantes, retiroActivo } from '../retiros/vencimiento'

export type NivelAlerta = 'critica' | 'alta' | 'media'

export interface Alerta {
  clave: string
  nivel: NivelAlerta
  modulo: 'Causas' | 'Retiros' | 'Boletas' | 'Respaldo'
  titulo: string
  detalle: string
  /** Pantalla a la que lleva (con el filtro ya puesto) */
  ruta: string
  /** Para ordenar dentro del mismo nivel: más alto, más arriba */
  peso: number
}

const ORDEN: Record<NivelAlerta, number> = { critica: 0, alta: 1, media: 2 }

export function calcularAlertas(
  d: { causas: Causa[]; retiros: Retiro[]; boletas: Boleta[]; pagos: Pago[] },
  a: Ajustes,
  diasSinRespaldo: number | null,
  hoy = hoyISO(),
): Alerta[] {
  const lista: Alerta[] = []
  const u = a.umbralesCausas

  // Causas
  const pendientes = d.causas.filter((c) => c.estado === 'Pendiente')
  const atrasadas = pendientes.filter((c) => prioridadCausa(c, u, hoy) === 'maxima').sort((x, y) => x.fechaEncargo.localeCompare(y.fechaEncargo))
  if (atrasadas.length) {
    const vieja = atrasadas[0]
    lista.push({
      clave: 'causas-atrasadas',
      nivel: 'critica',
      modulo: 'Causas',
      titulo: `${plural(atrasadas.length, 'causa atrasada', 'causas atrasadas')} (más de ${u.alta} días)`,
      detalle: `La más antigua: ${vieja.rol}, ${plural(diasDesdeEncargo(vieja, hoy), 'día', 'días')} desde el encargo.`,
      ruta: '/causas?prioridad=maxima',
      peso: atrasadas.length,
    })
  }
  const porAtrasarse = pendientes.filter((c) => prioridadCausa(c, u, hoy) === 'alta')
  if (porAtrasarse.length) {
    lista.push({
      clave: 'causas-alta',
      nivel: 'alta',
      modulo: 'Causas',
      titulo: `${plural(porAtrasarse.length, 'causa', 'causas')} por atrasarse (${u.media + 1} a ${u.alta} días)`,
      detalle: 'Conviene incluirlas en la próxima hoja de ruta.',
      ruta: '/causas?prioridad=alta',
      peso: porAtrasarse.length,
    })
  }
  const urgentes = pendientes.filter((c) => c.urgente)
  if (urgentes.length) {
    lista.push({
      clave: 'causas-urgentes',
      nivel: 'alta',
      modulo: 'Causas',
      titulo: `${plural(urgentes.length, 'causa urgente pendiente', 'causas urgentes pendientes')}`,
      detalle: urgentes.slice(0, 3).map((c) => c.rol).join(', ') + (urgentes.length > 3 ? '…' : ''),
      ruta: '/causas?prioridad=urgente',
      peso: urgentes.length + 1000,
    })
  }
  const sinEstampar = d.causas.filter((c) => c.estado === 'Realizada' && !c.estampadoPjud)
  if (sinEstampar.length) {
    lista.push({
      clave: 'causas-estampar',
      nivel: 'media',
      modulo: 'Causas',
      titulo: `${plural(sinEstampar.length, 'diligencia realizada', 'diligencias realizadas')} sin estampar en el PJUD`,
      detalle: sinEstampar.slice(0, 3).map((c) => c.rol).join(', ') + (sinEstampar.length > 3 ? '…' : ''),
      ruta: '/causas?estado=Realizada',
      peso: sinEstampar.length,
    })
  }

  // Retiros: uno por uno los vencidos y por vencer; agrupados los de prioridad de búsqueda
  const activos = d.retiros.filter(retiroActivo)
  for (const r of activos) {
    const al = alertasRetiro(r, a, hoy)
    const faltan = diasRestantes(r, hoy)
    const quien = [r.rol, r.patente, r.deudor].filter(Boolean).join(', ')
    if (al.vencido) {
      lista.push({ clave: `ret-v-${r.id}`, nivel: 'critica', modulo: 'Retiros', titulo: `Oficio vencido hace ${plural(-faltan, 'día', 'días')}`, detalle: quien, ruta: '/retiros?vence=vencido', peso: -faltan + 500 })
    } else if (al.renovar) {
      lista.push({
        clave: `ret-r-${r.id}`,
        nivel: 'alta',
        modulo: 'Retiros',
        titulo: faltan === 0 ? 'El oficio vence hoy: pedir renovación' : `Pedir renovación: el oficio vence en ${plural(faltan, 'día', 'días')}`,
        detalle: quien,
        ruta: '/retiros?vence=renovar',
        peso: 1000 - faltan,
      })
    }
  }
  const prioridad = activos.filter((r) => alertasRetiro(r, a, hoy).prioridad).sort((x, y) => x.fechaEncargo.localeCompare(y.fechaEncargo))
  if (prioridad.length) {
    lista.push({
      clave: 'ret-prioridad',
      nivel: 'media',
      modulo: 'Retiros',
      titulo: `${plural(prioridad.length, 'retiro', 'retiros')} con prioridad de búsqueda`,
      detalle: `${a.diasPrioridadBusqueda} días o más desde el encargo. El más antiguo: ${prioridad[0].rol} (${plural(diasEncargoRetiro(prioridad[0], hoy), 'día', 'días')}).`,
      ruta: '/retiros?vence=prioridad',
      peso: prioridad.length,
    })
  }

  // Boletas impagas por antigüedad
  const ub = a.umbralesBoletas
  const impagas = d.boletas.filter((b) => vigente(b) && saldoBoleta(b, d.pagos) > 0)
  const grupo = (nivel: 'tercera' | 'segunda' | 'primera', n: NivelAlerta, texto: string) => {
    const g = impagas.filter((b) => nivelBoleta(b, d.pagos, ub, hoy) === nivel).sort((x, y) => x.fechaEmision.localeCompare(y.fechaEmision))
    if (!g.length) return
    const monto = g.reduce((s, b) => s + saldoBoleta(b, d.pagos), 0)
    lista.push({
      clave: `bol-${nivel}`,
      nivel: n,
      modulo: 'Boletas',
      titulo: `${plural(g.length, 'boleta impaga', 'boletas impagas')} ${texto}: ${pesos(monto)}`,
      detalle: `La más antigua: N° ${g[0].numero}, emitida hace ${plural(diasDesdeEmision(g[0], hoy), 'día', 'días')}.`,
      ruta: '/boletas?pestana=impagas',
      peso: monto,
    })
  }
  grupo('tercera', 'critica', `con más de ${ub.tercera} días`)
  grupo('segunda', 'alta', `con ${ub.segunda} a ${ub.tercera} días`)
  grupo('primera', 'media', `con ${ub.primera} a ${ub.segunda} días`)

  // Respaldo
  if (diasSinRespaldo === null || diasSinRespaldo > 7) {
    lista.push({
      clave: 'respaldo',
      nivel: 'media',
      modulo: 'Respaldo',
      titulo: diasSinRespaldo === null ? 'Aún no ha respaldado sus datos' : `Hace ${plural(diasSinRespaldo, 'día', 'días')} que no respalda sus datos`,
      detalle: 'Descargue un respaldo completo y guárdelo fuera de este equipo.',
      ruta: '/configuracion',
      peso: 0,
    })
  }

  return lista.sort((x, y) => ORDEN[x.nivel] - ORDEN[y.nivel] || y.peso - x.peso)
}

// Convierte las filas de una planilla en causas, y decide qué hacer con cada una:
// agregarla como nueva, actualizarla como reencargo u omitirla (duplicada, de otro tribunal o con errores).
import type { Ajustes, Causa, Cliente, EstadoCausa, OrigenEncargo, ResultadoDiligencia } from '../../../db/tipos'
import { hoyISO } from '../../../utilidades/formato'
import { calcularDv, formatearRut, rutValido } from '../../../utilidades/rut'
import { normalizar } from '../../../utilidades/texto'
import { normalizarRol, nucleoRol, type DatosCausa } from '../servicioCausas'
import { celdaTexto, fechaDeCelda, type HojaDetectada } from './leerExcel'

export type Accion = 'nueva' | 'reencargo' | 'omitir'

export interface FilaAnalizada {
  /** Número de fila en la planilla (como la ve la usuaria en Excel) */
  numero: number
  datos: DatosCausa
  nombreCliente?: string
  accion: Accion
  /** Acción sugerida al analizar (la usuaria la puede cambiar) */
  sugerida: Accion
  /** Por qué se omite o qué se hace */
  motivo?: string
  avisos: string[]
  /** Causa existente que se actualiza si es reencargo */
  existenteId?: number
  demandadoDeObservaciones?: boolean
}

export interface OpcionesLote {
  tribunal: string
  /** Cliente para las filas que no traen columna de cliente */
  clienteIdLote?: number
  /** Fecha para las filas que no traen fecha */
  fechaRecepcion: string
  /** Letra para los ROL que vienen sin letra (E- exhorto, C- civil) */
  tipoSinLetra: string
}

const LETRA_TIPO: Record<string, string> = { E: 'Exhorto', C: 'Civil', P: 'Protección', O: 'Laboral', L: 'Laboral' }
export const letraDeTipo = (tipo: string) =>
  Object.entries(LETRA_TIPO).find(([, t]) => normalizar(t) === normalizar(tipo))?.[0] ?? tipo.charAt(0).toUpperCase()

const esCuranilahue = (t?: string) => !t || normalizar(t).includes('curanilahue')

/** Estado de la planilla original → estado de la app (según lo acordado con Mercedes) */
function convertirEstado(texto?: string): { estado: EstadoCausa; estampado?: boolean; resultado?: ResultadoDiligencia; detalle?: string } {
  const t = normalizar(texto)
  if (!t || t.includes('pendiente') || t.includes('terreno')) return { estado: 'Pendiente' }
  if (t.includes('suspend')) return { estado: 'Suspendida' }
  if (t.includes('devuel') || t.includes('cerrad')) return { estado: 'Devuelta' }
  if (t.includes('busqueda negativa')) return { estado: 'Realizada', resultado: 'Negativa', detalle: 'Búsqueda negativa' }
  if (t.includes('estampad') || t.includes('boleta') || t.includes('pagad')) return { estado: 'Realizada', estampado: true }
  if (t.includes('notificad') || t.includes('realizad')) return { estado: 'Realizada' }
  return { estado: 'Pendiente' }
}

function convertirOrigen(texto?: string): OrigenEncargo {
  const t = normalizar(texto)
  if (t.includes('suprema')) return 'Corte Suprema'
  if (t.includes('apelaciones')) return 'Corte de Apelaciones'
  if (t.includes('tribunal') || t.includes('juzgado')) return 'Tribunal'
  return 'Particular'
}

const esSi = (texto?: string) => ['si', 's', 'x', 'true', '1'].includes(normalizar(texto))

/** Resultado escrito libremente → positiva / negativa */
function convertirResultado(texto?: string): ResultadoDiligencia | undefined {
  const t = normalizar(texto)
  if (!t) return undefined
  if (t.includes('negativ') || t.includes('no se ubic') || t.includes('frustrad') || t.includes('no ubicad')) return 'Negativa'
  return 'Positiva'
}

/** Diligencia del archivo → tipo de la lista (misma lógica que la planilla Control de Encargos) */
function convertirDiligencia(texto: string | undefined, lista: string[]): { tipo: string; sobrante?: string } {
  if (!texto) return { tipo: 'Notificación' }
  const exacta = lista.find((d) => normalizar(d) === normalizar(texto))
  if (exacta) return { tipo: exacta }
  const t = normalizar(texto)
  let tipo = 'Notificación'
  if (t.includes('requer')) tipo = 'Notificación y requerimiento de pago'
  else if (t.includes('oposici')) tipo = 'Oposición al embargo'
  else if (t.includes('embargo')) tipo = 'Embargo'
  return { tipo, sobrante: texto }
}

const PALABRAS_NO_NOMBRE = new Set(['suspender', 'urgente', 'aviso', 'reenviado', 'pendiente', 'notificado', 'mencionado', 'pidio', 'nuevo', 'domicilio', 'causa', 'rol'])

/** Las observaciones suelen empezar con los apellidos del demandado: "MORALES SANTOS. SUSPENDER…" */
export function demandadoDesdeObservaciones(obs: string | undefined, excluir: (string | undefined)[]): string | undefined {
  if (!obs) return undefined
  const m = obs.match(/^\s*([A-ZÁÉÍÓÚÑÜ'][A-ZÁÉÍÓÚÑÜ' ]{2,60}?)\s*\./)
  if (!m) return undefined
  const nombre = m[1].trim().replace(/\s+/g, ' ')
  const palabras = nombre.split(' ')
  if (palabras.length < 2 || palabras.length > 6) return undefined
  if (palabras.some((p) => PALABRAS_NO_NOMBRE.has(normalizar(p)))) return undefined
  if (excluir.some((e) => e && normalizar(e) === normalizar(nombre))) return undefined
  return nombre
}

/** RUT del archivo: acepta "12.345.678-9", "12345678-9" o solo el número sin dígito verificador */
function convertirRut(v: unknown): { rut?: string; aviso?: string } {
  const t = celdaTexto(v as string)
  if (!t) return {}
  const limpio = t.replace(/[^0-9kK]/g, '')
  if (/^\d{6,8}$/.test(limpio) && !/[-]/.test(t)) {
    // Viene sin dígito verificador: se calcula
    return { rut: formatearRut(limpio + calcularDv(limpio)) }
  }
  if (rutValido(t)) return { rut: formatearRut(t) }
  return { aviso: `RUT «${t}» no válido; se deja en blanco` }
}

export function analizarFilas(
  hoja: HojaDetectada,
  opciones: OpcionesLote,
  existentes: Causa[],
  clientes: Cliente[],
  ajustes: Ajustes,
): FilaAnalizada[] {
  const m = hoja.mapa
  const col = (f: unknown[], campo: keyof typeof m) => (m[campo] === undefined ? undefined : f[m[campo]!])
  const txt = (f: unknown[], campo: keyof typeof m) => celdaTexto(col(f, campo) as string)

  const clientePorNombre = new Map(clientes.map((c) => [normalizar(c.nombre), c]))
  const clienteLote = clientes.find((c) => c.id === opciones.clienteIdLote)
  const porRol = new Map<string, Causa[]>()
  const porNucleo = new Map<string, Causa[]>()
  for (const c of existentes) {
    porRol.set(c.rol, [...(porRol.get(c.rol) ?? []), c])
    porNucleo.set(nucleoRol(c.rol), [...(porNucleo.get(nucleoRol(c.rol)) ?? []), c])
  }
  const vistasEnArchivo = new Set<string>()
  const hoy = hoyISO()

  return hoja.filas.map((f, i) => {
    const numero = hoja.filaEncabezado + 1 + i
    const avisos: string[] = []

    // ROL y tribunal: se prefiere el ROL del exhorto si el exhorto es de Curanilahue
    const rolExhorto = txt(f, 'rolExhorto')
    const tribExhorto = txt(f, 'tribunalExhorto')
    const rolSimple = txt(f, 'rol')
    const tribSimple = txt(f, 'tribunal')
    let rolTexto: string | undefined
    let deOtroTribunal = false
    if (rolExhorto) {
      rolTexto = rolExhorto
      deOtroTribunal = !esCuranilahue(tribExhorto)
    } else {
      rolTexto = rolSimple
      deOtroTribunal = !esCuranilahue(tribSimple)
    }

    // Letra del ROL: si no la trae, se usa la del tipo elegido para el lote
    let rol = normalizarRol(rolTexto ?? '')
    let tipoCausa = txt(f, 'tipo')
    const letra = rol.match(/^([A-Z]+)-/)?.[1]
    if (rol && !letra) {
      const tipoLote = opciones.tipoSinLetra
      rol = `${letraDeTipo(tipoLote)}-${rol}`
      tipoCausa = tipoCausa ?? tipoLote
    }
    const tipoLista = ajustes.tiposCausa.find((t) => normalizar(t) === normalizar(tipoCausa))
    tipoCausa = tipoLista ?? tipoCausa ?? LETRA_TIPO[letra ?? ''] ?? 'Civil'

    // Fecha de encargo
    const fechaArchivo = fechaDeCelda(col(f, 'fechaEncargo') as string)
    const fechaEncargo = fechaArchivo ?? opciones.fechaRecepcion
    if (!fechaArchivo && m.fechaEncargo !== undefined) avisos.push('Sin fecha: se usa la fecha de recepción')

    // Cliente
    const nombreCliente = txt(f, 'cliente') ?? clienteLote?.nombre
    const cliente = nombreCliente ? clientePorNombre.get(normalizar(nombreCliente)) : undefined

    // Estado, resultado y estampado
    const est = convertirEstado(txt(f, 'estado'))
    const textoResultado = txt(f, 'resultado')
    const estampado = est.estampado || esSi(txt(f, 'estampado'))

    // Diligencia
    const diligenciaTexto = txt(f, 'diligencia')
    const dil = convertirDiligencia(diligenciaTexto, ajustes.tiposDiligencia)

    // Observaciones (se agrega el texto original de la diligencia si no calzó con la lista)
    const obsArchivo = txt(f, 'observaciones')
    const observaciones = [dil.sobrante && normalizar(dil.sobrante) !== normalizar(dil.tipo) ? dil.sobrante : undefined, obsArchivo].filter(Boolean).join(' · ') || undefined

    // Demandado y RUT
    const mandante = txt(f, 'mandante')
    let demandado = txt(f, 'demandado')
    let demandadoDeObservaciones = false
    if (!demandado) {
      demandado = demandadoDesdeObservaciones(obsArchivo, [mandante, nombreCliente])
      demandadoDeObservaciones = !!demandado
    }
    const rut = convertirRut(col(f, 'rut'))
    if (rut.aviso) avisos.push(rut.aviso)

    const fechaDiligencia = fechaDeCelda(col(f, 'fechaDiligencia') as string)
    if (est.estado === 'Realizada' && !fechaDiligencia) avisos.push('Realizada sin fecha de diligencia')

    const textoReencargo = normalizar(`${diligenciaTexto ?? ''} ${obsArchivo ?? ''}`)
    const reencargo = esSi(txt(f, 'reencargo')) || textoReencargo.includes('reitera') || textoReencargo.includes('nuevo domicilio')
    const boletaNumero = Number(String(col(f, 'boleta') ?? '').replace(/\D/g, '')) || undefined

    const datos: DatosCausa = {
      rol,
      tipoCausa,
      tribunal: opciones.tribunal,
      mandante,
      clienteId: cliente?.id,
      demandado,
      rutDemandado: rut.rut,
      domicilio: txt(f, 'domicilio'),
      sector: txt(f, 'sector'),
      tipoDiligencia: dil.tipo,
      origen: convertirOrigen(txt(f, 'origen')),
      fechaEncargo,
      fechaDiligencia,
      estado: est.estado,
      resultado: est.resultado ?? convertirResultado(textoResultado),
      detalleResultado: textoResultado ?? est.detalle,
      observaciones,
      estampadoPjud: estampado,
      boletaNumero,
      urgente: normalizar(txt(f, 'prioridad')).includes('urgente') || undefined,
      reencargo: reencargo || undefined,
    }

    const fila: FilaAnalizada = { numero, datos, nombreCliente, accion: 'nueva', sugerida: 'nueva', avisos, demandadoDeObservaciones }
    const omitir = (motivo: string) => {
      fila.accion = fila.sugerida = 'omitir'
      fila.motivo = motivo
      return fila
    }

    if (!rolTexto) return omitir('Falta el ROL')
    if (deOtroTribunal) return omitir(`De otro tribunal${tribExhorto || tribSimple ? ` (${tribExhorto ?? tribSimple})` : ''}`)
    if (!fechaEncargo) return omitir('Falta la fecha de encargo')
    if (fechaEncargo > hoy) avisos.push('La fecha de encargo es posterior a hoy')

    // Repetida dentro del mismo archivo
    const claveArchivo = `${rol}|${fechaEncargo}|${normalizar(nombreCliente)}`
    if (vistasEnArchivo.has(claveArchivo)) return omitir('Repetida en este mismo archivo')
    vistasEnArchivo.add(claveArchivo)

    // Comparación con las causas ya guardadas
    const mismoCliente = (c: Causa) => (cliente?.id ? c.clienteId === cliente.id : !nombreCliente && !c.clienteId)
    const candidatas = porRol.get(rol) ?? (letra ? [] : porNucleo.get(nucleoRol(rol)) ?? [])
    if (candidatas.length) {
      const exacta = candidatas.find((c) => c.fechaEncargo === fechaEncargo && mismoCliente(c))
      if (exacta) return omitir('Ya está guardada (mismo ROL, fecha y cliente)')
      const abierta = candidatas
        .filter((c) => mismoCliente(c) && (c.estado === 'Pendiente' || c.estado === 'Suspendida'))
        .sort((a, b) => b.fechaEncargo.localeCompare(a.fechaEncargo))[0]
      if (abierta) {
        if (fechaEncargo <= abierta.fechaEncargo) return omitir(`Ya está guardada como ${abierta.rol} con fecha igual o más reciente`)
        fila.accion = fila.sugerida = 'reencargo'
        fila.existenteId = abierta.id
        fila.motivo = `Actualiza ${abierta.rol} (reencargo)`
        return fila
      }
      const otra = candidatas[0]
      avisos.push(`El ROL ya existe (${otra.rol}, ${otra.estado.toLowerCase()}); se agrega como diligencia nueva`)
    }
    return fila
  })
}

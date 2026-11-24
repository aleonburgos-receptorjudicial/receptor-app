// Importación masiva de retiros de vehículos desde Excel.
// Reconoce las columnas por los nombres configurados del formulario (así sirve el mismo Excel que exporta la app)
// y por nombres parecidos ("Juzgado", "PPU", "Deudor", "Vence"…). Cada fila queda como nueva, actualizar u omitir.
import * as XLSX from 'xlsx'
import { ESTADOS_RETIRO, type Ajustes, type CampoRetiro, type Cliente, type EstadoRetiro, type Familiar, type Retiro } from '../../../db/tipos'
import { hoyISO, sumarDias } from '../../../utilidades/formato'
import { normalizar } from '../../../utilidades/texto'
import { celdaTexto, fechaDeCelda, type Celda } from '../../causas/importar/leerExcel'
import { normalizarRol } from '../../causas/servicioCausas'
import { validarRetiro, type DatosRetiro, type ValorExtra } from '../servicioRetiros'

export type AccionRetiro = 'nuevo' | 'actualizar' | 'omitir'

/** Columna especial (no es un campo del formulario): familiares en el formato que exporta la app */
const FAMILIARES = '_familiares'

export interface HojaRetiros {
  nombre: string
  filaEncabezado: number
  encabezados: string[]
  filas: { numero: number; celdas: Celda[] }[]
  /** clave del campo → número de columna */
  mapa: Record<string, number>
}

export interface FilaRetiro {
  /** Número de fila en el Excel */
  numero: number
  accion: AccionRetiro
  datos: DatosRetiro
  /** Nombre del estudio escrito en el archivo (si no existe, se crea al guardar) */
  nombreCliente?: string
  existenteId?: number
  /** Por qué se omite (si corresponde) */
  motivo?: string
  avisos: string[]
  /** Campos que no venían en el archivo y se llenaron con un valor por defecto (no reemplazan a los guardados) */
  porDefecto: (keyof DatosRetiro)[]
}

// Nombres parecidos para cada campo de fábrica. Van de lo más específico a lo más general:
// la primera regla que calza se queda con la columna.
const REGLAS: { clave: string; exacto?: string[]; contiene?: string[]; todos?: string[][]; excluye?: string[] }[] = [
  { clave: 'martilleroTelefono', todos: [['martillero'], ['telefono', 'fono', 'celular', 'contacto']] },
  { clave: 'martilleroDireccion', todos: [['martillero'], ['direccion', 'domicilio']] },
  { clave: 'martilleroNombre', contiene: ['martillero'] },
  { clave: 'fechaEmision', contiene: ['emision', 'fecha oficio', 'fecha del oficio'] },
  { clave: 'fechaVencimiento', contiene: ['vencimiento', 'vence', 'vigente hasta', 'vigencia hasta'] },
  { clave: 'fechaRetiro', contiene: ['fecha retiro', 'fecha del retiro', 'fecha de retiro'] },
  { clave: 'fechaEncargo', contiene: ['encargo', 'recepcion', 'ingreso', 'solicitud', 'llego'] },
  { clave: 'fuerzaPublicaConcedida', todos: [['fuerza'], ['concedida', 'otorgada']] },
  { clave: 'fuerzaPublicaSolicitada', contiene: ['fuerza'] },
  { clave: FAMILIARES, contiene: ['familiar', 'relacionado'] },
  { clave: 'rutDeudor', contiene: ['rut'] },
  { clave: 'rol', exacto: ['rol', 'causa', 'causa rol', 'rol causa', 'n rol', 'rol de la causa', 'numero de causa'], contiene: ['rol '] },
  { clave: 'tribunal', contiene: ['tribunal', 'juzgado'] },
  { clave: 'patente', contiene: ['patente', 'ppu', 'placa'] },
  { clave: 'marca', contiene: ['marca'] },
  { clave: 'modelo', contiene: ['modelo'] },
  { clave: 'color', contiene: ['color'] },
  { clave: 'anio', exacto: ['ano', 'anio', 'año', 'ano vehiculo', 'año vehiculo', 'ano fabricacion', 'año fabricacion'] },
  { clave: 'deudor', contiene: ['demandado', 'deudor', 'ejecutado'] },
  { clave: 'mandante', contiene: ['mandante', 'acreedor', 'banco', 'financiera'] },
  { clave: 'clienteId', contiene: ['estudio', 'cliente', 'abogado'] },
  { clave: 'revisionTecnica', contiene: ['revision tecnica', 'revision'] },
  { clave: 'permisoCirculacion', contiene: ['permiso'] },
  { clave: 'direccion', contiene: ['domicilio', 'direccion'] },
  { clave: 'horaRetiro', contiene: ['hora'] },
  { clave: 'lugarRetiro', contiene: ['lugar'] },
  { clave: 'custodio', contiene: ['deposito', 'custodio', 'bodega'] },
  { clave: 'estado', exacto: ['estado', 'estado actual', 'situacion'] },
  { clave: 'observaciones', contiene: ['observ', 'nota', 'comentario'], exacto: ['obs'] },
]

/** Decide qué columna corresponde a cada campo: primero el nombre configurado exacto, después los parecidos */
export function reconocerColumnasRetiro(encabezados: string[], campos: CampoRetiro[]): Record<string, number> {
  const mapa: Record<string, number> = {}
  const usadas = new Set<number>()
  const textos = encabezados.map((h) => normalizar(h))
  // 1. Nombre exacto de un campo del formulario (incluye los campos propios de Mercedes)
  textos.forEach((t, i) => {
    if (!t) return
    const c = campos.find((c) => normalizar(c.etiqueta) === t && mapa[c.clave] === undefined)
    if (c) {
      mapa[c.clave] = i
      usadas.add(i)
    } else if (t === normalizar('Familiares del demandado')) {
      mapa[FAMILIARES] = i
      usadas.add(i)
    }
  })
  // 2. Nombres parecidos
  textos.forEach((t, i) => {
    if (!t || usadas.has(i)) return
    for (const r of REGLAS) {
      if (mapa[r.clave] !== undefined) continue
      if (r.excluye?.some((x) => t.includes(x))) continue
      const calza =
        r.exacto?.includes(t) ||
        r.contiene?.some((x) => (` ${t} `).includes(x.endsWith(' ') ? ` ${x}` : x)) ||
        r.todos?.every((grupo) => grupo.some((x) => t.includes(x)))
      if (calza) {
        mapa[r.clave] = i
        usadas.add(i)
        return
      }
    }
  })
  return mapa
}

// Un encabezado de ROL es corto ("ROL", "Causa ROL"); los textos largos (instrucciones) no cuentan
const pareceEncabezadoRol = (v: Celda) => {
  const t = normalizar(String(v ?? ''))
  return t.length > 0 && t.length <= 40 && (/\brol\b/.test(t) || t === 'causa')
}

/** Busca en cada hoja la fila de encabezados y las filas con datos */
export function detectarHojasRetiros(libro: XLSX.WorkBook, campos: CampoRetiro[]): HojaRetiros[] {
  const hojas: HojaRetiros[] = []
  for (const nombre of libro.SheetNames) {
    // Las hojas que empiezan con "_" son de ayuda (ejemplo, instrucciones)
    if (nombre.startsWith('_')) continue
    const filas = XLSX.utils.sheet_to_json<Celda[]>(libro.Sheets[nombre], { header: 1, raw: true, defval: null, blankrows: true })
    const idx = filas.slice(0, 25).findIndex((f) => f.some(pareceEncabezadoRol))
    if (idx < 0) continue
    const encabezados = filas[idx].map((h) => String(h ?? '').trim())
    const mapa = reconocerColumnasRetiro(encabezados, campos)
    if (mapa.rol === undefined) continue
    const datos = filas
      .map((celdas, i) => ({ numero: i + 1, celdas }))
      .slice(idx + 1)
      .filter((f) => f.celdas.some((v) => v !== null && v !== '') && celdaTexto(f.celdas[mapa.rol]))
    if (!datos.length) continue
    hojas.push({ nombre, filaEncabezado: idx + 1, encabezados, filas: datos, mapa })
  }
  return hojas.sort((a, b) => b.filas.length - a.filas.length)
}

/** "Sí", "si", "x", "1" → verdadero; "No", "0" → falso */
function siNo(v: Celda): boolean | undefined {
  if (typeof v === 'boolean') return v
  const t = normalizar(celdaTexto(v))
  if (!t) return undefined
  if (['si', 's', 'x', '1', 'true', 'verdadero', 'yes'].includes(t)) return true
  if (['no', 'n', '0', 'false', 'falso'].includes(t)) return false
  return undefined
}

/** Familiares escritos como en la exportación: "Nombre (relación), RUT; Otro nombre" */
export function leerFamiliares(texto?: string): Familiar[] | undefined {
  if (!texto) return undefined
  const lista = texto
    .split(/;|\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const m = p.match(/^(.*?)(?:\s*\(([^)]*)\))?\s*(?:,\s*([\dkK.\-\s]{7,}))?$/)
      return { nombre: (m?.[1] ?? p).trim(), relacion: m?.[2]?.trim() || undefined, rut: m?.[3]?.trim() || undefined }
    })
    .filter((f) => f.nombre)
  return lista.length ? lista : undefined
}

/** Hora de una celda: "14:30", o la fracción de día que guarda Excel (0,604…) */
function horaDeCelda(v: Celda): string | undefined {
  if (typeof v === 'number' && v >= 0 && v < 1) {
    const min = Math.round(v * 24 * 60)
    return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
  }
  if (v instanceof Date) return `${String(v.getHours()).padStart(2, '0')}:${String(v.getMinutes()).padStart(2, '0')}`
  return celdaTexto(v)
}

const estadoDe = (v: Celda): EstadoRetiro | undefined => {
  const t = normalizar(celdaTexto(v))
  if (!t) return undefined
  return ESTADOS_RETIRO.find((e) => normalizar(e) === t) ?? (t.startsWith('retirad') ? 'Retirado' : t.includes('busqueda') ? 'En búsqueda' : t.startsWith('suspend') ? 'Suspendido' : undefined)
}

const claveDuplicado = (rol: string, patente?: string) => `${normalizarRol(rol)}|${(patente ?? '').replace(/[^A-Z0-9]/gi, '').toUpperCase()}`

export interface OpcionesLote {
  /** Estudio para las filas sin estudio (cuando el archivo no trae esa columna) */
  clienteIdLote?: number
  /** Fecha de encargo para las filas que no la traen */
  fechaRecepcion: string
}

/** Convierte cada fila del Excel en un retiro y decide si es nuevo, si actualiza uno existente o si se omite */
export function analizarRetiros(hoja: HojaRetiros, opciones: OpcionesLote, existentes: Retiro[], clientes: Cliente[], ajustes: Ajustes): FilaRetiro[] {
  const campos = ajustes.camposRetiro
  const porNombreCliente = new Map(clientes.map((c) => [normalizar(c.nombre), c.id!]))
  const existentePorClave = new Map(existentes.map((r) => [claveDuplicado(r.rol, r.patente), r]))
  const vistosEnArchivo = new Map<string, number>()
  const hoy = hoyISO()

  return hoja.filas.map(({ numero, celdas }) => {
    const avisos: string[] = []
    const porDefecto: (keyof DatosRetiro)[] = []
    const celda = (clave: string): Celda => (hoja.mapa[clave] === undefined ? undefined : celdas[hoja.mapa[clave]])
    const texto = (clave: string) => celdaTexto(celda(clave))
    const fecha = (clave: string) => {
      const v = celda(clave)
      const f = fechaDeCelda(v)
      if (!f && celdaTexto(v)) avisos.push(`No se entendió la fecha «${celdaTexto(v)}» (${campos.find((c) => c.clave === clave)?.etiqueta ?? clave}).`)
      return f
    }

    // Estudio jurídico: se busca por nombre; si no existe, se creará al guardar
    let clienteId: number | undefined
    let nombreCliente: string | undefined
    const textoCliente = texto('clienteId')
    if (textoCliente) {
      nombreCliente = textoCliente
      clienteId = porNombreCliente.get(normalizar(textoCliente))
    } else if (opciones.clienteIdLote) {
      clienteId = opciones.clienteIdLote
      nombreCliente = clientes.find((c) => c.id === clienteId)?.nombre
    }

    // Campos propios de Mercedes
    const extras: Record<string, ValorExtra> = {}
    for (const c of campos.filter((c) => !c.base && hoja.mapa[c.clave] !== undefined)) {
      const v = celda(c.clave)
      if (c.tipo === 'fecha') extras[c.clave] = fechaDeCelda(v) ?? null
      else if (c.tipo === 'sino') extras[c.clave] = siNo(v) ?? null
      else if (c.tipo === 'numero') extras[c.clave] = typeof v === 'number' ? v : Number(celdaTexto(v)?.replace(',', '.')) || null
      else extras[c.clave] = celdaTexto(v) ?? null
    }

    const anioTexto = texto('anio')
    const anio = anioTexto ? Number(anioTexto.replace(/\D/g, '')) || undefined : undefined
    const textoEstado = texto('estado')
    const estado = estadoDe(celda('estado'))
    if (textoEstado && !estado) avisos.push(`Estado «${textoEstado}» no reconocido: queda Pendiente.`)
    if (!estado) porDefecto.push('estado')

    const fechaEmision = fecha('fechaEmision')
    let fechaVencimiento = fecha('fechaVencimiento')
    if (!fechaVencimiento && fechaEmision && ajustes.vigenciaOficioDias) {
      fechaVencimiento = sumarDias(fechaEmision, ajustes.vigenciaOficioDias)
      avisos.push(`Vencimiento calculado: ${ajustes.vigenciaOficioDias} días desde la emisión.`)
    }
    let fechaEncargo = fecha('fechaEncargo')
    if (!fechaEncargo) {
      fechaEncargo = opciones.fechaRecepcion
      porDefecto.push('fechaEncargo')
      // Si el archivo no trae la columna, la fecha del lote se elige arriba y no hace falta avisar fila por fila
      if (hoja.mapa.fechaEncargo !== undefined) avisos.push('Sin fecha de encargo: se usa la fecha elegida para el lote.')
    }

    const bruto: DatosRetiro = {
      rol: texto('rol') ?? '',
      tribunal: texto('tribunal') ?? '',
      fechaEmision,
      fechaVencimiento: fechaVencimiento ?? '',
      fechaEncargo,
      estado: estado ?? 'Pendiente',
      patente: texto('patente'),
      marca: texto('marca'),
      modelo: texto('modelo'),
      color: texto('color'),
      anio,
      deudor: texto('deudor'),
      rutDeudor: texto('rutDeudor'),
      mandante: texto('mandante'),
      clienteId,
      martilleroNombre: texto('martilleroNombre'),
      martilleroTelefono: texto('martilleroTelefono'),
      martilleroDireccion: texto('martilleroDireccion'),
      revisionTecnica: texto('revisionTecnica'),
      permisoCirculacion: texto('permisoCirculacion'),
      direccion: texto('direccion'),
      fuerzaPublicaSolicitada: siNo(celda('fuerzaPublicaSolicitada')),
      fuerzaPublicaConcedida: siNo(celda('fuerzaPublicaConcedida')),
      fechaRetiro: fecha('fechaRetiro'),
      horaRetiro: horaDeCelda(celda('horaRetiro')),
      lugarRetiro: texto('lugarRetiro'),
      custodio: texto('custodio'),
      observaciones: texto('observaciones'),
      familiares: leerFamiliares(texto(FAMILIARES)),
      extras,
    }

    // Se usa la misma revisión que el formulario. Las fallas menores quedan como aviso y el dato se guarda tal cual.
    const { errores, datos } = validarRetiro(bruto, campos)
    let motivo: string | undefined
    if (errores.rol) motivo = 'Falta el ROL.'
    else if (errores.fechaVencimiento) motivo = bruto.fechaVencimiento ? errores.fechaVencimiento : 'Falta la fecha de vencimiento del oficio.'
    if (errores.fechaEmision) avisos.push(bruto.fechaEmision ? errores.fechaEmision : 'Sin fecha de emisión del oficio.')
    if (errores.fechaEncargo && bruto.fechaEncargo) {
      avisos.push(`${errores.fechaEncargo} Se usa la fecha de hoy.`)
      datos.fechaEncargo = hoy
    }
    if (errores.patente) {
      avisos.push(`Patente «${bruto.patente}» con formato distinto al chileno: revísela.`)
      datos.patente = bruto.patente?.toUpperCase()
    }
    if (errores.rutDeudor) {
      avisos.push(`RUT «${bruto.rutDeudor}» no válido: revíselo.`)
      datos.rutDeudor = bruto.rutDeudor
    }
    if (errores.anio) {
      avisos.push(errores.anio)
      datos.anio = undefined
    }
    if (errores.horaRetiro) {
      avisos.push(`Hora del retiro «${bruto.horaRetiro}» no reconocida.`)
      datos.horaRetiro = undefined
    }
    if (errores.fechaRetiro) avisos.push(errores.fechaRetiro)
    if (!datos.tribunal) avisos.push('Sin tribunal.')

    // ¿Ya existe (mismo ROL y patente) o está repetido dentro del mismo archivo?
    const clave = claveDuplicado(datos.rol, datos.patente)
    const existente = datos.rol ? existentePorClave.get(clave) : undefined
    let accion: AccionRetiro = existente ? 'actualizar' : 'nuevo'
    if (motivo) accion = 'omitir'
    else if (vistosEnArchivo.has(clave)) {
      accion = 'omitir'
      motivo = `Repetido en el archivo (igual a la fila ${vistosEnArchivo.get(clave)}).`
    }
    if (datos.rol && !vistosEnArchivo.has(clave)) vistosEnArchivo.set(clave, numero)

    return { numero, accion, datos, nombreCliente, existenteId: existente?.id, motivo, avisos, porDefecto }
  })
}

/**
 * Une un retiro guardado con lo que trae el Excel: los datos del archivo reemplazan a los guardados,
 * pero las celdas vacías no borran nada.
 */
export function unirConExistente(anterior: Retiro, nuevo: DatosRetiro, porDefecto: (keyof DatosRetiro)[] = []): DatosRetiro {
  const { id: _id, creado: _c, actualizado: _a, ejemplo: _e, ...base } = anterior
  const resultado: DatosRetiro = { ...base }
  for (const [k, v] of Object.entries(nuevo) as [keyof DatosRetiro, unknown][]) {
    if (v === undefined || v === null || v === '' || porDefecto.includes(k)) continue
    if (k === 'extras') {
      const extras = { ...(anterior.extras ?? {}) }
      for (const [ke, ve] of Object.entries(v as Record<string, ValorExtra>)) if (ve !== null && ve !== '') extras[ke] = ve
      resultado.extras = Object.keys(extras).length ? extras : undefined
    } else if (k === 'familiares') {
      if ((v as Familiar[]).length) resultado.familiares = v as Familiar[]
    } else {
      ;(resultado as Record<string, unknown>)[k] = v
    }
  }
  return resultado
}

// Lectura flexible de planillas Excel: encuentra sola la hoja y la fila de encabezados,
// y reconoce las columnas aunque tengan nombres distintos ("Causa ROL", "ROL EXHORTO", "NOMBRE DEL DEUDOR"…).
import * as XLSX from 'xlsx'
import { normalizar } from '../../../utilidades/texto'

export type Celda = string | number | boolean | Date | null | undefined

/** Campos de una causa que se pueden leer desde una planilla */
export type CampoImportable =
  | 'fechaEncargo'
  | 'fechaDiligencia'
  | 'rolExhorto'
  | 'tribunalExhorto'
  | 'rol'
  | 'tribunal'
  | 'cliente'
  | 'mandante'
  | 'rut'
  | 'demandado'
  | 'diligencia'
  | 'domicilio'
  | 'sector'
  | 'prioridad'
  | 'estado'
  | 'resultado'
  | 'estampado'
  | 'reencargo'
  | 'boleta'
  | 'observaciones'
  | 'tipo'
  | 'origen'

export const NOMBRE_CAMPO: Record<CampoImportable, string> = {
  fechaEncargo: 'Fecha de encargo',
  fechaDiligencia: 'Fecha de diligencia',
  rolExhorto: 'ROL exhorto',
  tribunalExhorto: 'Tribunal exhorto',
  rol: 'ROL',
  tribunal: 'Tribunal',
  cliente: 'Cliente / estudio',
  mandante: 'Mandante',
  rut: 'RUT del demandado',
  demandado: 'Demandado',
  diligencia: 'Tipo de diligencia',
  domicilio: 'Domicilio',
  sector: 'Sector',
  prioridad: 'Prioridad',
  estado: 'Estado',
  resultado: 'Resultado',
  estampado: 'Estampado PJUD',
  reencargo: 'Reencargo',
  boleta: 'N° de boleta',
  observaciones: 'Observaciones',
  tipo: 'Tipo de causa',
  origen: 'Origen',
}

// Reglas en orden de prioridad: la primera que calza se queda con la columna.
// "exacto" compara el encabezado completo; "contiene" busca el texto dentro del encabezado.
const REGLAS: { campo: CampoImportable; exacto?: string[]; contiene?: string[]; patron?: RegExp; excluye?: string[] }[] = [
  { campo: 'fechaEncargo', contiene: ['fecha solicitud', 'fecha de solicitud', 'fecha de encargo', 'fecha encargo', 'fecha del encargo', 'fecha recepcion', 'fecha de recepcion', 'fecha ingreso'] },
  { campo: 'fechaDiligencia', contiene: ['fecha actuacion', 'fecha de actuacion', 'fecha diligencia', 'fecha de diligencia', 'fecha notificacion'] },
  { campo: 'rolExhorto', contiene: ['rol exhorto'] },
  { campo: 'tribunalExhorto', contiene: ['tribunal exhorto'] },
  { campo: 'rol', exacto: ['rol', 'causa', 'causa rol', 'rol causa', 'n rol'], patron: /\brol\b/, excluye: ['origen'] },
  { campo: 'tribunal', contiene: ['tribunal', 'juzgado'], excluye: ['origen'] },
  { campo: 'cliente', contiene: ['cliente', 'estudio'] },
  { campo: 'mandante', contiene: ['mandante'] },
  { campo: 'rut', contiene: ['rut'] },
  { campo: 'demandado', contiene: ['demandado', 'deudor', 'a notificar', 'notificado'] },
  { campo: 'diligencia', contiene: ['diligencia', 'encargo', 'etapa', 'fase', 'gestion'], excluye: ['reencargo', 'fecha'] },
  { campo: 'domicilio', contiene: ['direccion', 'domicilio'] },
  { campo: 'sector', contiene: ['sector', 'comuna'] },
  { campo: 'prioridad', contiene: ['prioridad', 'prioritario', 'urgente'] },
  { campo: 'estado', exacto: ['estado', 'estado actual'] },
  { campo: 'resultado', contiene: ['resultado'] },
  { campo: 'estampado', contiene: ['estampado', 'pjud'] },
  { campo: 'reencargo', contiene: ['reencargo'] },
  { campo: 'boleta', contiene: ['n boleta', 'numero boleta', 'nro boleta', 'boleta n'] },
  { campo: 'observaciones', contiene: ['observ', 'obs ', 'nota'], exacto: ['obs'] },
  { campo: 'tipo', exacto: ['tipo', 'tipo causa', 'tipo de causa'] },
  { campo: 'origen', exacto: ['origen', 'origen del encargo'] },
]

/** Decide qué columna corresponde a cada campo */
export function reconocerColumnas(encabezados: Celda[]): Partial<Record<CampoImportable, number>> {
  const mapa: Partial<Record<CampoImportable, number>> = {}
  encabezados.forEach((h, i) => {
    const t = normalizar(String(h ?? ''))
    if (!t) return
    for (const r of REGLAS) {
      if (mapa[r.campo] !== undefined) continue
      if (r.excluye?.some((x) => t.includes(x))) continue
      const calza = r.exacto?.includes(t) || r.contiene?.some((x) => t.includes(x)) || r.patron?.test(t)
      if (calza) {
        mapa[r.campo] = i
        return
      }
    }
  })
  return mapa
}

export interface HojaDetectada {
  nombre: string
  filaEncabezado: number
  encabezados: string[]
  filas: Celda[][]
  mapa: Partial<Record<CampoImportable, number>>
}

// Un encabezado es corto; los textos largos (instrucciones) no cuentan
const pareceEncabezadoRol = (v: Celda) => {
  const t = normalizar(String(v ?? ''))
  return t.length <= 40 && /\brol\b/.test(t)
}

/** Busca en todas las hojas la fila de encabezados (la que tiene una columna parecida a "rol") */
export function detectarHojas(libro: XLSX.WorkBook): HojaDetectada[] {
  const hojas: HojaDetectada[] = []
  for (const nombre of libro.SheetNames) {
    // Las hojas auxiliares (que empiezan con "_") no tienen datos para importar
    if (nombre.startsWith('_')) continue
    const filas = XLSX.utils.sheet_to_json<Celda[]>(libro.Sheets[nombre], { header: 1, raw: true, defval: null, blankrows: false })
    const idx = filas.slice(0, 25).findIndex((f) => f.some(pareceEncabezadoRol))
    if (idx < 0) continue
    const encabezados = filas[idx].map((h) => String(h ?? '').trim())
    const mapa = reconocerColumnas(encabezados)
    const colRol = mapa.rolExhorto ?? mapa.rol
    if (colRol === undefined) continue
    const datos = filas.slice(idx + 1).filter((f) => f.some((v) => v !== null && v !== '') && (celdaTexto(f[colRol]) || (mapa.rol !== undefined && celdaTexto(f[mapa.rol]))))
    if (datos.length === 0) continue
    hojas.push({ nombre, filaEncabezado: idx + 1, encabezados, filas: datos, mapa })
  }
  return hojas.sort((a, b) => b.filas.length - a.filas.length)
}

/** Lee las listas de la hoja "Listas" (tipos de diligencia, resultados, sectores, clientes) */
export function leerListas(libro: XLSX.WorkBook): { diligencias: string[]; resultados: string[]; sectores: string[]; clientes: string[]; tiposCausa: string[] } | null {
  const nombre = libro.SheetNames.find((n) => normalizar(n) === 'listas')
  if (!nombre) return null
  const filas = XLSX.utils.sheet_to_json<Celda[]>(libro.Sheets[nombre], { header: 1, raw: true, defval: null })
  if (!filas.length) return null
  const columna = (...claves: string[]) => {
    const i = filas[0].findIndex((h) => claves.some((c) => normalizar(String(h ?? '')).startsWith(c)))
    if (i < 0) return []
    return filas
      .slice(1)
      .map((f) => celdaTexto(f[i]))
      .filter((v): v is string => !!v)
  }
  return {
    diligencias: columna('diligencia'),
    resultados: columna('resultado'),
    sectores: columna('sector'),
    clientes: columna('cliente'),
    tiposCausa: columna('tipo'),
  }
}

export function leerArchivo(archivo: File): Promise<XLSX.WorkBook> {
  return archivo.arrayBuffer().then((buf) => XLSX.read(buf, { cellDates: true, dense: true }))
}

/** Texto limpio de una celda, o undefined si está vacía */
export function celdaTexto(v: Celda): string | undefined {
  if (v === null || v === undefined) return undefined
  if (v instanceof Date) return fechaDeCelda(v)
  const t = String(v).trim()
  return t || undefined
}

const pad = (n: number) => String(n).padStart(2, '0')

/** Convierte una celda de fecha (fecha de Excel, número o texto dd/mm/aaaa) a "AAAA-MM-DD" */
export function fechaDeCelda(v: Celda): string | undefined {
  if (v === null || v === undefined || v === '') return undefined
  if (v instanceof Date) {
    // Se suman 12 horas para evitar desfases por zona horaria
    const d = new Date(v.getTime() + 12 * 3600_000)
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  }
  if (typeof v === 'number' && v > 20000 && v < 80000) {
    const p = XLSX.SSF.parse_date_code(v)
    return `${p.y}-${pad(p.m)}-${pad(p.d)}`
  }
  const t = String(v).trim()
  let m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/)
  if (m) {
    let anio = Number(m[3])
    if (anio < 100) anio += 2000
    const dia = Number(m[1])
    const mes = Number(m[2])
    if (mes >= 1 && mes <= 12 && dia >= 1 && dia <= 31) return `${anio}-${pad(mes)}-${pad(dia)}`
    return undefined
  }
  m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m) return `${m[1]}-${pad(Number(m[2]))}-${pad(Number(m[3]))}`
  return undefined
}

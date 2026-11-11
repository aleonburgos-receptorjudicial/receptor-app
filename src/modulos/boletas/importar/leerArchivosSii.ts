// Lectura de los archivos del SII:
//   - PDF de una boleta de honorarios electrónica (N°, fecha, cliente, RUT, glosa, montos y si está ANULADA)
//   - Informe mensual de boletas emitidas (.xls), que en realidad es una tabla HTML con el estado vigente/anulada
import * as XLSX from 'xlsx'
import type { PagadorRetencion } from '../../../db/tipos'
import { abrirPdf, limpiarTextoPdf, lineasDePagina } from '../../../compartido/pdf'
import { formatearRut, rutValido } from '../../../utilidades/rut'
import { normalizar } from '../../../utilidades/texto'

/** Una boleta tal como viene en un archivo del SII */
export interface BoletaLeida {
  numero: number
  fechaEmision?: string
  nombreCliente?: string
  rutCliente?: string
  glosa?: string
  bruto: number
  porcentajeRetencion?: number
  retencion: number
  liquido: number
  pagaRetencion: PagadorRetencion
  anulada: boolean
  fechaAnulacion?: string
  /** ROL de causas que aparecen en la glosa (para asociarlas) */
  roles: string[]
  origen: 'pdf' | 'informe'
  archivo: string
}

const MESES: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
}
const pad = (n: number) => String(n).padStart(2, '0')

/** "235.989" → 235989 */
const pesos = (t?: string) => (t ? Number(t.replace(/[^\d]/g, '')) || 0 : 0)

/** "15.25" o "15,25" → 15.25 */
const porcentaje = (t?: string) => (t ? Number(t.replace(',', '.')) : undefined)

/** "05/10/2026" → "2026-10-05" */
function fechaDMA(t?: string): string | undefined {
  const m = t?.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  return m ? `${m[3]}-${pad(Number(m[2]))}-${pad(Number(m[1]))}` : undefined
}

const rutLimpio = (t?: string) => {
  const r = t?.replace(/\s+/g, '')
  return r && rutValido(r) ? formatearRut(r) : undefined
}

/** ROL que aparecen en un texto: "E-492-2026", "C-15-2025" */
export function rolesEnTexto(t: string): string[] {
  return Array.from(new Set([...limpiarTextoPdf(t).toUpperCase().matchAll(/\b([A-Z])\s*-\s*(\d{1,6})\s*-\s*(\d{4})\b/g)].map((m) => `${m[1]}-${m[2]}-${m[3]}`)))
}

/** Lee el PDF de una boleta de honorarios electrónica del SII */
export async function leerBoletaPdf(archivo: File): Promise<BoletaLeida> {
  const { pdf, cerrar } = await abrirPdf(archivo)
  let lineas: string[] = []
  try {
    for (let n = 1; n <= pdf.numPages; n++) lineas = lineas.concat((await lineasDePagina(await pdf.getPage(n))).map((l) => limpiarTextoPdf(l.texto)))
  } finally {
    await cerrar()
  }
  const texto = lineas.join('\n')
  const numero = Number(texto.match(/N\s*°\s*(\d+)/)?.[1] ?? 0)
  if (!numero || !/honorarios/i.test(texto)) throw new Error('No parece una boleta de honorarios del SII.')

  let fechaEmision: string | undefined
  const f = texto.match(/Fecha:\s*(\d{1,2})\s+de\s+([A-Za-zé]+)\s+de\s+(\d{4})/i)
  if (f && MESES[normalizar(f[2])]) fechaEmision = `${f[3]}-${pad(MESES[normalizar(f[2])])}-${pad(Number(f[1]))}`
  fechaEmision ??= fechaDMA(texto.match(/Fecha\s*\/\s*Hora\s*Emisi[oó]n:\s*([\d/]+)/i)?.[1])

  const cliente = texto.match(/Señor\(es\):\s*(.+?)\s+Rut:\s*([\d.\s]+-\s*[\dkK])/i)
  // Glosa: líneas entre "Por atención profesional:" y "Total Honorarios" (sin el monto al final)
  const ini = lineas.findIndex((l) => /por atenci[oó]n profesional/i.test(l))
  const fin = lineas.findIndex((l) => /total honorarios/i.test(l))
  const glosa =
    ini >= 0 && fin > ini
      ? lineas
          .slice(ini + 1, fin)
          .map((l) => l.replace(/\s+\$?\s*[\d.]+$/, '').trim())
          .filter(Boolean)
          .join(' / ')
          // El PDF separa los guiones: "C - 512 - 2026" → "C-512-2026"
          .replace(/\b([A-Z])\s*-\s*(\d{1,6})\s*-\s*(\d{4})\b/g, '$1-$2-$3')
          .replace(/\s+,/g, ',')
      : undefined

  const bruto = pesos(texto.match(/Total\s+Honorarios:?\s*\$?\s*:?\s*([\d.]+)/i)?.[1])
  const ret = texto.match(/([\d.,]+)\s*%\s*Impto\.?\s*Retenido:?\s*\$?\s*([\d.]+)/i)
  const retencion = pesos(ret?.[2])
  const liquido = pesos(texto.match(/^\s*Total:?\s*\$?\s*([\d.]+)\s*$/im)?.[1]) || bruto - retencion
  // Si dice que el receptor de la boleta debe retener, la retención la hace el cliente
  const pagaRetencion: PagadorRetencion = /receptor de esta boleta debe retener/i.test(texto) || !/emisor/i.test(texto) ? 'Cliente' : 'Receptor'

  return {
    numero,
    fechaEmision,
    nombreCliente: cliente?.[1]?.trim(),
    rutCliente: rutLimpio(cliente?.[2]),
    glosa,
    bruto,
    porcentajeRetencion: porcentaje(ret?.[1]),
    retencion,
    liquido,
    pagaRetencion,
    anulada: /\bANULAD[AO]\b/i.test(texto),
    roles: rolesEnTexto(glosa ?? ''),
    origen: 'pdf',
    archivo: archivo.name,
  }
}

type Celda = string | number | null | undefined

/** El SII escribe las tildes como códigos HTML ("Retenci&oacute;n"): se traducen a letras */
function decodificarEntidades(html: string): string {
  const nombres: Record<string, string> = {
    aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú',
    ntilde: 'ñ', Ntilde: 'Ñ', uuml: 'ü', Uuml: 'Ü', deg: '°', ordm: 'º', ordf: 'ª', nbsp: ' ',
  }
  return html
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&([a-zA-Z]+);/g, (m, n) => nombres[n] ?? m)
}

/** Lee el informe mensual de boletas emitidas del SII (.xls que es una tabla HTML, o un Excel real) */
export async function leerInformeSii(archivo: File): Promise<BoletaLeida[]> {
  const bytes = new Uint8Array(await archivo.arrayBuffer())
  const primero = bytes.find((b) => b > 32)
  const libro =
    primero === 0x3c // "<": es HTML; el SII lo guarda en Latin-1
      ? XLSX.read(decodificarEntidades(new TextDecoder('windows-1252').decode(bytes)), { type: 'string', raw: true })
      : XLSX.read(bytes, { type: 'array', raw: true })
  const filas = XLSX.utils.sheet_to_json<Celda[]>(libro.Sheets[libro.SheetNames[0]], { header: 1, raw: false, defval: null })
  const n = (c: Celda) => normalizar(String(c ?? ''))
  const iEnc = filas.findIndex((f) => f.some((c) => n(c) === 'estado') && f.some((c) => n(c).startsWith('bruto')))
  if (iEnc < 0) throw new Error('No se encontró la tabla de boletas (columnas «Estado» y «Brutos»).')
  const enc = filas[iEnc].map(n)
  const col = (...nombres: string[]) => enc.findIndex((h) => nombres.some((x) => h === x || h.startsWith(x)))
  const c = {
    numero: col('n', 'numero', 'nro'),
    fecha: col('fecha boleta', 'fecha emision'),
    estado: col('estado'),
    anulacion: col('fecha anulacion'),
    rut: col('rut'),
    nombre: col('nombre o razon social', 'nombre', 'razon social'),
    bruto: col('brutos', 'bruto'),
    retEmisor: col('retencion emisor'),
    retReceptor: col('retencion receptor'),
    liquido: col('liquidos', 'liquido'),
  }
  const leidas: BoletaLeida[] = []
  for (const f of filas.slice(iEnc + 1)) {
    const numero = Number(String(f[c.numero] ?? '').replace(/\D/g, ''))
    if (!numero) continue // fila de totales u otras
    const bruto = pesos(String(f[c.bruto] ?? ''))
    const retEmisor = c.retEmisor >= 0 ? pesos(String(f[c.retEmisor] ?? '')) : 0
    const retReceptor = c.retReceptor >= 0 ? pesos(String(f[c.retReceptor] ?? '')) : 0
    const retencion = retEmisor + retReceptor
    const estado = n(f[c.estado])
    leidas.push({
      numero,
      fechaEmision: fechaDMA(String(f[c.fecha] ?? '')),
      nombreCliente: String(f[c.nombre] ?? '').trim() || undefined,
      rutCliente: rutLimpio(String(f[c.rut] ?? '')),
      bruto,
      porcentajeRetencion: bruto ? Math.round((retencion / bruto) * 10000) / 100 : undefined,
      retencion,
      liquido: pesos(String(f[c.liquido] ?? '')) || bruto - retencion,
      pagaRetencion: retEmisor > 0 && retReceptor === 0 ? 'Receptor' : 'Cliente',
      anulada: !!estado && estado !== 'vigente',
      fechaAnulacion: fechaDMA(String(f[c.anulacion] ?? '')),
      roles: [],
      origen: 'informe',
      archivo: archivo.name,
    })
  }
  return leidas
}

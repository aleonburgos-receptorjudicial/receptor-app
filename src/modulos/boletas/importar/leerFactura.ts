// Lectura del PDF de una factura electrónica (formato del SII y de los sistemas de facturación habituales).
// Todo se lee dentro del equipo con pdf.js: el PDF no se envía a ningún servicio.
import type { Empresa } from '../../../db/tipos'
import { abrirPdf, limpiarTextoPdf, lineasDePagina } from '../../../compartido/pdf'
import { formatearRut, limpiarRut, rutValido } from '../../../utilidades/rut'
import { normalizar } from '../../../utilidades/texto'

export interface FacturaLeida {
  numero: number
  fechaEmision?: string
  empresaRut?: string
  empresaNombre?: string
  nombreCliente?: string
  rutCliente?: string
  glosa?: string
  neto: number
  exento: number
  iva: number
  total: number
  /** Factura exenta (sin IVA) */
  exenta: boolean
  /** Avisos de la lectura (montos que no cuadran, datos que faltan…) */
  avisos: string[]
}

const MESES: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
}
const pad = (n: number) => String(n).padStart(2, '0')

/** "1.234.567" → 1234567 */
const monto = (t?: string) => (t ? Number(t.replace(/[^\d]/g, '')) || 0 : 0)

// RUT chileno con o sin puntos: 76.123.456-7, 76123456-7
const RUT = /\b(\d{1,2}\.?\d{3}\.?\d{3}\s*-\s*[\dkK])\b/g

/** Fecha de emisión: «12 de Noviembre del 2026», «12-11-2026», «12/11/2026» o «2026-11-12» */
function leerFecha(texto: string): string | undefined {
  const larga = texto.match(/(\d{1,2})\s+de\s+([A-Za-zÁÉÍÓÚáéíóú]+)\s+(?:de|del)\s+(\d{4})/i)
  if (larga && MESES[normalizar(larga[2])]) return `${larga[3]}-${pad(MESES[normalizar(larga[2])])}-${pad(Number(larga[1]))}`
  const iso = texto.match(/\b(\d{4})-(\d{2})-(\d{2})\b/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const corta = texto.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})\b/)
  if (corta && Number(corta[2]) <= 12) return `${corta[3]}-${pad(Number(corta[2]))}-${pad(Number(corta[1]))}`
  return undefined
}

/** Monto que sigue a una etiqueta («MONTO NETO $ 100.000», «I.V.A. 19% $ 19.000») */
function montoTras(texto: string, etiqueta: RegExp): number | undefined {
  const m = texto.match(new RegExp(`(?:${etiqueta.source})[^\\d\\n$]{0,12}\\$?\\s*([\\d.]+)`, 'i'))
  return m ? monto(m[1]) : undefined
}

/**
 * Interpreta el texto de una factura. Se separa de la lectura del PDF para poder probarlo.
 * «empresas» son las empresas de la usuaria: si el PDF trae uno de esos RUT, esa es la emisora.
 */
export function interpretarFactura(lineas: string[], empresas: Empresa[]): FacturaLeida {
  const texto = lineas.map(limpiarTextoPdf).join('\n')
  const avisos: string[] = []
  if (/nota\s+de\s+cr[eé]dito/i.test(texto) && !/factura/i.test(texto.split(/nota\s+de\s+cr[eé]dito/i)[0])) {
    throw new Error('Es una nota de crédito, no una factura. Si anula una factura, márquela como «Anulada».')
  }
  const posFactura = texto.search(/factura/i)
  if (posFactura < 0) throw new Error('No parece una factura: no dice «Factura» en ninguna parte.')
  const exenta = /factura\s+(no\s+afecta\s+o\s+)?exenta/i.test(texto)

  // Folio: el N° que sigue a la palabra «Factura» (o «Folio»)
  const trasFactura = texto.slice(posFactura)
  const numero = Number(trasFactura.match(/N\s*[°ºo]\.?\s*:?\s*0*(\d{1,10})/i)?.[1] ?? texto.match(/folio\s*:?\s*0*(\d{1,10})/i)?.[1] ?? 0)
  if (!numero) throw new Error('No se encontró el N° (folio) de la factura.')

  // RUT que aparecen, en orden y sin repetir
  const ruts: { rut: string; pos: number }[] = []
  for (const m of texto.matchAll(RUT)) {
    const r = m[1].replace(/\s+/g, '')
    if (rutValido(r) && !ruts.some((x) => limpiarRut(x.rut) === limpiarRut(r))) ruts.push({ rut: formatearRut(r), pos: m.index ?? 0 })
  }
  const deEmpresa = (r: string) => empresas.find((e) => limpiarRut(e.rut) === limpiarRut(r))

  // Cliente (receptor): lo que sigue a «Señor(es)», «Razón social», «Cliente» o «Receptor»
  const etiquetaCliente = texto.match(/(se[ñn]or(?:\s*\(\s*es\s*\))?|raz[oó]n\s+social|cliente|receptor)\s*:\s*/i)
  let rutCliente: string | undefined
  let nombreCliente: string | undefined
  if (etiquetaCliente) {
    const desde = (etiquetaCliente.index ?? 0) + etiquetaCliente[0].length
    nombreCliente = texto
      .slice(desde)
      .split(/\n|R\.?\s*U\.?\s*T\.?|GIRO/i)[0]
      .trim()
      .replace(/[:\s]+$/, '') || undefined
    rutCliente = ruts.find((x) => x.pos >= desde && !deEmpresa(x.rut))?.rut ?? ruts.find((x) => x.pos >= desde)?.rut
  }

  // Empresa emisora: la que coincide con «Mis empresas»; si no, el primer RUT que no es del cliente
  const conocida = ruts.map((x) => deEmpresa(x.rut)).find(Boolean)
  const empresaRut = conocida?.rut ?? ruts.find((x) => x.rut !== rutCliente)?.rut
  let empresaNombre = conocida?.nombre
  if (!empresaNombre) {
    // La razón social del emisor suele ser la primera línea del documento (sin el recuadro del SII)
    empresaNombre = lineas
      .map((l) => limpiarTextoPdf(l).replace(/R\.?\s*U\.?\s*T\.?\s*:?\s*[\d.\s]+-\s*[\dkK]/gi, '').replace(/factura.*$/i, '').replace(/\bN\s*[°º]\s*\d+/g, '').trim())
      .find((l) => /[A-Za-zÁÉÍÓÚÑáéíóúñ]{3}/.test(l) && !/^(giro|direcci|s\.?\s*i\.?\s*i|fecha|comuna|ciudad|tel[eé]fono|e-?mail|correo)/i.test(l))
  }
  if (rutCliente && deEmpresa(rutCliente) && !conocida) avisos.push('El cliente es una de sus empresas: parece una factura recibida, no emitida.')
  if (!empresaRut) avisos.push('No se encontró el RUT de la empresa emisora.')

  const fechaEmision = leerFecha(texto.match(/fecha\s*(?:de\s*)?emisi[oó]n\s*:?\s*([^\n]+)/i)?.[1] ?? '') ?? leerFecha(texto)
  if (!fechaEmision) avisos.push('No se encontró la fecha de emisión.')

  // Montos
  let neto = montoTras(texto, /monto\s+neto|\bneto\b/) ?? 0
  const exento = montoTras(texto, /monto\s+exento|\bexento\b/) ?? 0
  let iva = montoTras(texto, /\bI\.?\s*V\.?\s*A\.?(?:\s*\(?\s*19\s*%\s*\)?)?/) ?? 0
  const totales = [...texto.matchAll(/(?<!sub\s?)(?:monto\s+)?\btotal\b[^\d\n$]{0,12}\$?\s*([\d.]+)/gi)].map((m) => monto(m[1])).filter((n) => n > 0)
  let total = totales.length ? Math.max(...totales) : 0
  if (exenta) {
    iva = 0
    neto = 0
  }
  if (!total) total = neto + exento + iva
  if (!neto && !exenta && total && iva) neto = total - iva - exento
  if (!neto && !exento && !iva && total) {
    // Solo trae el total: se separa el IVA
    neto = Math.round(total / 1.19)
    iva = total - neto
    avisos.push('El PDF solo trae el total: el neto y el IVA se calcularon.')
  }
  if (Math.abs(neto + exento + iva - total) > 1) avisos.push(`Los montos no cuadran: neto + exento + IVA no da el total. Revise la factura.`)

  // Detalle: líneas entre el encabezado de la tabla («Descripción») y los totales
  const iniDet = lineas.findIndex((l) => /descripci[oó]n|detalle/i.test(l))
  const finDet = lineas.findIndex((l, i) => i > iniDet && /monto\s+neto|\bneto\b|monto\s+exento|\bexento\b|\btotal\b|timbre/i.test(l))
  const glosa =
    iniDet >= 0 && finDet > iniDet
      ? lineas
          .slice(iniDet + 1, finDet)
          .map((l) => limpiarTextoPdf(l).replace(/^[-–•\s]+/, '').replace(/(\s+\$?\s*[\d.,]+%?)+$/, '').trim())
          .filter((l) => /[A-Za-zÁÉÍÓÚÑáéíóúñ]{3}/.test(l))
          .slice(0, 4)
          .join(' / ') || undefined
      : undefined

  return { numero, fechaEmision, empresaRut, empresaNombre, nombreCliente, rutCliente, glosa, neto, exento, iva, total, exenta, avisos }
}

/** Lee el PDF de una factura electrónica */
export async function leerFacturaPdf(archivo: Blob, empresas: Empresa[]): Promise<FacturaLeida> {
  const { pdf, cerrar } = await abrirPdf(archivo)
  let lineas: string[] = []
  try {
    // La primera página trae todos los datos; las demás, a veces, más detalle
    for (let n = 1; n <= Math.min(pdf.numPages, 3); n++) lineas = lineas.concat((await lineasDePagina(await pdf.getPage(n))).map((l) => l.texto))
  } finally {
    await cerrar()
  }
  if (!lineas.join('').trim()) throw new Error('El PDF no tiene texto (puede ser una foto o un escaneo). Ingrese la factura a mano y adjunte el PDF.')
  return interpretarFactura(lineas, empresas)
}

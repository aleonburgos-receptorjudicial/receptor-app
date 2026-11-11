// Genera el PDF de la "Hoja de ruta — Diligencias en terreno" con el formato de Mercedes:
// carta horizontal, 10 diligencias por hoja, casillas para marcar a mano. Todo se hace en el navegador.
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from 'pdf-lib'
import type { Causa } from '../../db/tipos'
import { fechaCL } from '../../utilidades/formato'
import { normalizar } from '../../utilidades/texto'

export interface FilaHojaRuta {
  causa: Causa
  solicitante?: string
}

const AZUL = rgb(0x1f / 255, 0x38 / 255, 0x64 / 255)
const CELESTE = rgb(0xdc / 255, 0xe6 / 255, 0xf2 / 255)
const GRIS = rgb(0.35, 0.35, 0.35)
const NEGRO = rgb(0, 0, 0)
const BORDE = rgb(0.45, 0.45, 0.45)

const POR_HOJA = 10
const ANCHO = 792 // carta horizontal (11 × 8,5 pulgadas)
const ALTO = 612
const MARGEN = 36
// Columnas (suman 720 puntos)
const COLUMNAS = [
  { titulo: 'N°', ancho: 25 },
  { titulo: 'Rol', ancho: 70 },
  { titulo: 'Solicitante\n(abogado / estudio)', ancho: 80 },
  { titulo: 'Notificado / Parte', ancho: 95 },
  { titulo: 'Dirección / Sector', ancho: 120 },
  { titulo: 'Diligencia', ancho: 110 },
  { titulo: 'Hora', ancho: 35 },
  { titulo: 'Resultado', ancho: 90 },
  { titulo: 'Observaciones', ancho: 95 },
]

/** Las fuentes estándar del PDF no tienen todos los signos: se reemplazan los que no existen */
function seguro(fuente: PDFFont, texto: string): string {
  const t = texto.replace(/[‐‑‒−]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ')
  let salida = ''
  for (const ch of t) {
    try {
      fuente.encodeText(ch)
      salida += ch
    } catch {
      salida += '?'
    }
  }
  return salida
}

/** Corta un texto en líneas que caben en un ancho; si sobra, termina con "…" */
function envolver(fuente: PDFFont, texto: string, tam: number, ancho: number, maxLineas: number): string[] {
  const palabras = seguro(fuente, texto).split(' ').filter(Boolean)
  const lineas: string[] = []
  let actual = ''
  for (const p of palabras) {
    const prueba = actual ? `${actual} ${p}` : p
    if (fuente.widthOfTextAtSize(prueba, tam) <= ancho) actual = prueba
    else {
      if (actual) lineas.push(actual)
      actual = p
      // Palabra más larga que la celda: se corta
      while (fuente.widthOfTextAtSize(actual, tam) > ancho && actual.length > 1) {
        let corte = actual.length - 1
        while (corte > 1 && fuente.widthOfTextAtSize(actual.slice(0, corte), tam) > ancho) corte--
        lineas.push(actual.slice(0, corte))
        actual = actual.slice(corte)
      }
    }
  }
  if (actual) lineas.push(actual)
  if (lineas.length > maxLineas) {
    const recorte = lineas.slice(0, maxLineas)
    let ultima = recorte[maxLineas - 1]
    while (ultima && fuente.widthOfTextAtSize(`${ultima}…`, tam) > ancho) ultima = ultima.slice(0, -1)
    recorte[maxLineas - 1] = `${ultima}…`
    return recorte
  }
  return lineas
}

/** Casilla para marcar; si "marcada", lleva un visto */
function casilla(pagina: PDFPage, x: number, y: number, marcada = false) {
  const t = 6
  pagina.drawRectangle({ x, y, width: t, height: t, borderColor: NEGRO, borderWidth: 0.6 })
  if (marcada) {
    pagina.drawLine({ start: { x: x + 1.2, y: y + 3 }, end: { x: x + 2.6, y: y + 1.3 }, thickness: 1, color: NEGRO })
    pagina.drawLine({ start: { x: x + 2.6, y: y + 1.3 }, end: { x: x + 5.2, y: y + 5.2 }, thickness: 1, color: NEGRO })
  }
}

/** Qué casilla de diligencia corresponde al tipo de la causa */
function tipoMarcado(tipo?: string): { personal: boolean; art44: boolean; cedula: boolean; otra?: string } {
  const t = normalizar(tipo)
  if (!t) return { personal: false, art44: false, cedula: false }
  const personal = t.includes('personal')
  const art44 = t.includes('44')
  const cedula = t.includes('cedula')
  if (personal || art44 || cedula) return { personal, art44, cedula }
  return { personal: false, art44: false, cedula: false, otra: tipo }
}

export async function generarHojaRuta(filas: FilaHojaRuta[], fecha: string, encabezado: string): Promise<Blob> {
  const pdf = await PDFDocument.create()
  pdf.setTitle(`Hoja de ruta ${fechaCL(fecha)}`)
  pdf.setCreator('Receptor Judicial')
  const normal = await pdf.embedFont(StandardFonts.Helvetica)
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold)
  const hojas = Math.max(1, Math.ceil(filas.length / POR_HOJA))

  for (let h = 0; h < hojas; h++) {
    const p = pdf.addPage([ANCHO, ALTO])
    // Encabezado
    p.drawText(seguro(negrita, 'HOJA DE RUTA — DILIGENCIAS EN TERRENO'), { x: MARGEN, y: ALTO - 52, size: 14, font: negrita, color: AZUL })
    p.drawText(seguro(normal, encabezado), { x: MARGEN, y: ALTO - 64, size: 8.5, font: normal, color: GRIS })
    if (hojas > 1) {
      const txt = `Hoja ${h + 1} de ${hojas}`
      p.drawText(txt, { x: ANCHO - MARGEN - normal.widthOfTextAtSize(txt, 8.5), y: ALTO - 52, size: 8.5, font: normal, color: GRIS })
    }
    p.drawLine({ start: { x: MARGEN, y: ALTO - 72 }, end: { x: ANCHO - MARGEN, y: ALTO - 72 }, thickness: 0.8, color: NEGRO })
    p.drawText('Fecha:', { x: MARGEN + 4, y: ALTO - 90, size: 8.5, font: negrita })
    p.drawText(fechaCL(fecha), { x: MARGEN + 34, y: ALTO - 90, size: 8.5, font: normal })
    p.drawLine({ start: { x: MARGEN + 32, y: ALTO - 93 }, end: { x: MARGEN + 100, y: ALTO - 93 }, thickness: 0.4, color: GRIS })

    // Encabezado de la tabla
    const arriba = ALTO - 112
    const altoTitulo = 22
    const altoFila = 41.6
    let x = MARGEN
    p.drawRectangle({ x: MARGEN, y: arriba - altoTitulo, width: ANCHO - 2 * MARGEN, height: altoTitulo, color: AZUL })
    for (const c of COLUMNAS) {
      const lineas = c.titulo.split('\n')
      lineas.forEach((l, i) => {
        const tam = i === 0 ? 7.5 : 6.5
        const w = negrita.widthOfTextAtSize(seguro(negrita, l), tam)
        const yTexto = arriba - altoTitulo / 2 - (lineas.length === 1 ? 2.5 : i === 0 ? -1.5 : 6.5)
        p.drawText(seguro(negrita, l), { x: x + (c.ancho - w) / 2, y: yTexto, size: tam, font: negrita, color: rgb(1, 1, 1) })
      })
      x += c.ancho
    }

    // Filas
    for (let i = 0; i < POR_HOJA; i++) {
      const n = h * POR_HOJA + i
      const fila = filas[n]
      const techo = arriba - altoTitulo - i * altoFila
      const piso = techo - altoFila
      let cx = MARGEN
      COLUMNAS.forEach((c, k) => {
        if (k === 0) p.drawRectangle({ x: cx, y: piso, width: c.ancho, height: altoFila, color: CELESTE })
        p.drawRectangle({ x: cx, y: piso, width: c.ancho, height: altoFila, borderColor: BORDE, borderWidth: 0.5 })
        cx += c.ancho
      })
      // N°
      const num = String(n + 1)
      p.drawText(num, { x: MARGEN + (25 - negrita.widthOfTextAtSize(num, 9)) / 2, y: piso + altoFila / 2 - 3, size: 9, font: negrita })

      // Borde izquierdo de cada columna
      const xs: number[] = []
      COLUMNAS.forEach((_, k) => xs.push(k === 0 ? MARGEN : xs[k - 1] + COLUMNAS[k - 1].ancho))
      const texto = (k: number, contenido: string, opciones: { negrita?: boolean; maxLineas?: number; tam?: number } = {}) => {
        const f = opciones.negrita ? negrita : normal
        const tam = opciones.tam ?? 7.5
        const lineas = envolver(f, contenido, tam, COLUMNAS[k].ancho - 6, opciones.maxLineas ?? 4)
        lineas.forEach((l, j) => p.drawText(l, { x: xs[k] + 3, y: techo - 10 - j * 9, size: tam, font: f }))
      }

      if (fila) {
        const c = fila.causa
        texto(1, c.rol, { negrita: true, maxLineas: 2, tam: 8 })
        if (c.urgente) p.drawText('URGENTE', { x: xs[1] + 3, y: piso + 4, size: 6.5, font: negrita, color: rgb(0.7, 0.1, 0.1) })
        texto(2, fila.solicitante ?? '')
        texto(3, [c.demandado, c.rutDemandado].filter(Boolean).join(', '))
        texto(4, [c.domicilio, c.sector && c.sector !== c.domicilio ? `(${c.sector})` : ''].filter(Boolean).join(' '))
      }

      // Diligencia: casillas Personal / Art. 44 / Cédula / Otra
      const marcado = tipoMarcado(fila?.causa.tipoDiligencia)
      const dx = xs[5] + 4
      const fila1 = techo - 9
      const fila2 = techo - 18
      casilla(p, dx, fila1, marcado.personal)
      p.drawText('Personal', { x: dx + 8, y: fila1 + 0.5, size: 6.5, font: normal })
      casilla(p, dx + 50, fila1, marcado.art44)
      p.drawText('Art. 44', { x: dx + 58, y: fila1 + 0.5, size: 6.5, font: normal })
      casilla(p, dx, fila2, marcado.cedula)
      p.drawText('Cédula', { x: dx + 8, y: fila2 + 0.5, size: 6.5, font: normal })
      casilla(p, dx + 50, fila2, !!marcado.otra)
      p.drawText('Otra:', { x: dx + 58, y: fila2 + 0.5, size: 6.5, font: normal })
      if (marcado.otra) {
        envolver(normal, marcado.otra, 6.5, COLUMNAS[5].ancho - 8, 2).forEach((l, j) => p.drawText(l, { x: dx, y: fila2 - 9 - j * 8, size: 6.5, font: normal }))
      } else {
        p.drawLine({ start: { x: dx, y: fila2 - 8 }, end: { x: xs[5] + COLUMNAS[5].ancho - 6, y: fila2 - 8 }, thickness: 0.4, color: GRIS })
        p.drawLine({ start: { x: dx, y: fila2 - 16 }, end: { x: xs[5] + COLUMNAS[5].ancho - 6, y: fila2 - 16 }, thickness: 0.4, color: GRIS })
      }

      // Resultado: Notificado / Búsqueda (1ª / 2ª) / No habido / Pendiente
      const rx = xs[7] + 4
      ;['Notificado', 'Búsqueda (1ª / 2ª)', 'No habido', 'Pendiente'].forEach((t, j) => {
        const yy = techo - 9 - j * 8.5
        casilla(p, rx, yy)
        p.drawText(seguro(normal, t), { x: rx + 8, y: yy + 0.5, size: 6.5, font: normal })
      })
    }

    // Pie
    const pie = arriba - altoTitulo - POR_HOJA * altoFila - 12
    p.drawText('Marque con', { x: MARGEN, y: pie, size: 6.5, font: normal, color: GRIS })
    const vx = MARGEN + normal.widthOfTextAtSize('Marque con ', 6.5)
    p.drawLine({ start: { x: vx, y: pie + 2.5 }, end: { x: vx + 1.6, y: pie + 0.8 }, thickness: 0.8, color: GRIS })
    p.drawLine({ start: { x: vx + 1.6, y: pie + 0.8 }, end: { x: vx + 4.5, y: pie + 5 }, thickness: 0.8, color: GRIS })
    p.drawText('el casillero que corresponda.', { x: vx + 7, y: pie, size: 6.5, font: normal, color: GRIS })
  }
  const bytes = await pdf.save()
  return new Blob([bytes.slice().buffer], { type: 'application/pdf' })
}

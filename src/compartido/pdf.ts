// Herramientas comunes para leer PDF dentro del navegador con pdf.js (sin enviar nada a internet).
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy, type PDFPageProxy } from 'pdfjs-dist'
import urlTrabajador from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

GlobalWorkerOptions.workerSrc = urlTrabajador

/** Abre un PDF y entrega el documento; llamar a "cerrar" al terminar */
export async function abrirPdf(archivo: Blob): Promise<{ pdf: PDFDocumentProxy; cerrar: () => Promise<void> }> {
  const tarea = getDocument({ data: new Uint8Array(await archivo.arrayBuffer()) })
  const pdf = await tarea.promise
  return { pdf, cerrar: () => tarea.destroy() }
}

export interface LineaPdf {
  y: number
  items: { x: number; texto: string }[]
  texto: string
}

/** Textos de una página agrupados en líneas, de arriba hacia abajo */
export async function lineasDePagina(pagina: PDFPageProxy): Promise<LineaPdf[]> {
  const contenido = await pagina.getTextContent()
  const lineas: LineaPdf[] = []
  const items = contenido.items
    .filter((i): i is typeof i & { str: string; transform: number[] } => 'str' in i && !!i.str.trim())
    .map((i) => ({ x: i.transform[4], y: i.transform[5], texto: i.str.trim() }))
    .sort((a, b) => b.y - a.y || a.x - b.x)
  for (const it of items) {
    const linea = lineas.find((l) => Math.abs(l.y - it.y) < 2.5)
    if (linea) linea.items.push({ x: it.x, texto: it.texto })
    else lineas.push({ y: it.y, items: [{ x: it.x, texto: it.texto }], texto: '' })
  }
  for (const l of lineas) {
    l.items.sort((a, b) => a.x - b.x)
    l.texto = l.items.map((i) => i.texto).join(' ').replace(/\s+/g, ' ').trim()
  }
  return lineas.sort((a, b) => b.y - a.y)
}

/** Reemplaza guiones y espacios "raros" que traen algunos PDF (como el signo menos "−" del SII) */
export function limpiarTextoPdf(t: string): string {
  return t.replace(/[‐-―−]/g, '-').replace(/[   ]/g, ' ')
}

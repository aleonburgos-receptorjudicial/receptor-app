// Lectura de informes de domicilios de los dealers (formato "Directorio Direcciones" de DealerNET).
// Todo ocurre dentro del navegador: el PDF no se envía a ningún servicio.
//
// Qué se obtiene:
//   - titular (nombre y RUT), fecha de consulta y fuente
//   - domicilios por sección (más probables, alternativos, laborales) con comuna, relación
//     y las notas de contactabilidad y calidad (estrellas de 0 a 5, con medias)
//   - relacionados (RUT, nombre y parentesco)
//
// Las estrellas son imágenes: se dibuja la página y se mide cuánto color tiene cada estrella.
import { getDocument, GlobalWorkerOptions, OPS, type PDFPageProxy } from 'pdfjs-dist'
import urlTrabajador from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { DomicilioInforme, InformeLeido, SeccionDomicilio } from '../../../db/tipos'
import { normalizar } from '../../../utilidades/texto'

GlobalWorkerOptions.workerSrc = urlTrabajador

export type { DomicilioInforme, InformeLeido, SeccionDomicilio }

interface Linea {
  y: number
  items: { x: number; texto: string }[]
  texto: string
}

const RUT = /^\d{1,2}\.?\d{3}\.?\d{3}-[\dkK]$/
const ETIQUETAS_NOTA = new Set(['contactabilidad', 'calidad'])

/** Agrupa los textos de la página en líneas (de arriba hacia abajo) */
async function leerLineas(pagina: PDFPageProxy): Promise<{ lineas: Linea[]; etiquetas: { tipo: 'contactabilidad' | 'calidad'; y: number }[] }> {
  const contenido = await pagina.getTextContent()
  const items = contenido.items
    .filter((i): i is typeof i & { str: string; transform: number[] } => 'str' in i && !!i.str.trim())
    .map((i) => ({ x: i.transform[4], y: i.transform[5], texto: i.str.trim() }))
  const etiquetas: { tipo: 'contactabilidad' | 'calidad'; y: number }[] = []
  const lineas: Linea[] = []
  for (const it of items.sort((a, b) => b.y - a.y || a.x - b.x)) {
    const n = normalizar(it.texto)
    if (ETIQUETAS_NOTA.has(n)) {
      etiquetas.push({ tipo: n as 'contactabilidad' | 'calidad', y: it.y })
      continue
    }
    const linea = lineas.find((l) => Math.abs(l.y - it.y) < 2.5)
    if (linea) linea.items.push({ x: it.x, texto: it.texto })
    else lineas.push({ y: it.y, items: [{ x: it.x, texto: it.texto }], texto: '' })
  }
  for (const l of lineas) {
    l.items.sort((a, b) => a.x - b.x)
    l.texto = l.items.map((i) => i.texto).join(' ').replace(/\s+/g, ' ').trim()
  }
  return { lineas: lineas.sort((a, b) => b.y - a.y), etiquetas }
}

/**
 * Busca las estrellas (imágenes pequeñas y cuadradas en la mitad derecha de la página),
 * mide su color y devuelve las filas de notas: { y del centro, nota de 0 a 5 }.
 */
async function leerEstrellas(pagina: PDFPageProxy): Promise<{ y: number; nota: number }[]> {
  const ops = await pagina.getOperatorList()
  const vista = pagina.getViewport({ scale: 1 })
  // Se sigue la matriz de transformación para saber dónde se dibuja cada imagen
  type Matriz = [number, number, number, number, number, number]
  const multiplicar = (m: Matriz, n: Matriz): Matriz => [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ]
  let actual: Matriz = [1, 0, 0, 1, 0, 0]
  const pila: Matriz[] = []
  const cajas: { x: number; y: number; w: number; h: number }[] = []
  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i]
    if (fn === OPS.save) pila.push(actual)
    else if (fn === OPS.restore) actual = pila.pop() ?? [1, 0, 0, 1, 0, 0]
    else if (fn === OPS.transform) actual = multiplicar(actual, ops.argsArray[i] as Matriz)
    else if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject) {
      const [a, , , d, e, f] = actual
      const w = Math.abs(a)
      const h = Math.abs(d)
      // Las estrellas miden entre 8 y 25 puntos, son casi cuadradas y están a la derecha
      if (w >= 8 && w <= 25 && h >= 8 && h <= 25 && Math.abs(w - h) < 4 && e > vista.width * 0.5) {
        cajas.push({ x: Math.min(e, e + a), y: Math.min(f, f + d), w, h })
      }
    }
  }
  if (!cajas.length) return []

  // Se dibuja la página en memoria para medir el color de cada estrella
  const escala = 3
  const vistaGrande = pagina.getViewport({ scale: escala })
  const lienzo = document.createElement('canvas')
  lienzo.width = Math.ceil(vistaGrande.width)
  lienzo.height = Math.ceil(vistaGrande.height)
  const ctx = lienzo.getContext('2d', { willReadFrequently: true })
  if (!ctx) return []
  await pagina.render({ canvas: lienzo, canvasContext: ctx, viewport: vistaGrande }).promise

  const medidas = cajas.map((c) => {
    const [x1, y1] = vistaGrande.convertToViewportPoint(c.x, c.y) as [number, number]
    const [x2, y2] = vistaGrande.convertToViewportPoint(c.x + c.w, c.y + c.h) as [number, number]
    const px = Math.round(Math.min(x1, x2))
    const py = Math.round(Math.min(y1, y2))
    const ancho = Math.max(1, Math.round(Math.abs(x2 - x1)))
    const alto = Math.max(1, Math.round(Math.abs(y2 - y1)))
    const datos = ctx.getImageData(px, py, ancho, alto).data
    let color = 0
    let gris = 0
    for (let k = 0; k < datos.length; k += 4) {
      const r = datos[k]
      const g = datos[k + 1]
      const b = datos[k + 2]
      const max = Math.max(r, g, b)
      const min = Math.min(r, g, b)
      if (max - min > 60) color++ // parte pintada (estrella llena)
      else if (max < 215) gris++ // contorno gris (estrella vacía)
    }
    return { y: c.y + c.h / 2, x: c.x, color, gris }
  })
  // Referencia: una estrella llena (la con más color) o una vacía (la con más gris)
  const llena = Math.max(...medidas.map((m) => m.color))
  const vacia = Math.max(...medidas.map((m) => m.gris))
  const relleno = (m: (typeof medidas)[number]) => {
    if (llena > 0) return Math.min(1, m.color / llena)
    return vacia > 0 ? Math.max(0, 1 - m.gris / vacia) : 0
  }

  // Se agrupan en filas por altura y se suma el relleno (redondeado a media estrella)
  const filas: { y: number; total: number }[] = []
  for (const m of medidas) {
    const fila = filas.find((f) => Math.abs(f.y - m.y) < 3)
    if (fila) fila.total += relleno(m)
    else filas.push({ y: m.y, total: relleno(m) })
  }
  return filas.map((f) => ({ y: f.y, nota: Math.min(5, Math.round(f.total * 2) / 2) }))
}

function seccionDe(texto: string): SeccionDomicilio | 'relacionados' | 'fin' | 'otra' | null {
  const t = normalizar(texto)
  if (t.startsWith('direcciones mas probables')) return 'Más probable'
  if (t.startsWith('direcciones alternativas')) return 'Alternativo'
  if (t.startsWith('direcciones laborales')) return 'Laboral'
  if (t === 'relacionados') return 'relacionados'
  if (t === 'fuentes') return 'fin'
  if (t === 'resumen') return 'otra'
  return null
}

const esPieOCabecera = (t: string, titular?: string, rut?: string) => {
  const n = normalizar(t)
  return (
    n.startsWith('el presente informe') ||
    n.startsWith('es para uso exclusivo') ||
    n.startsWith('impreso por') ||
    (!!titular && n === normalizar(titular)) ||
    (!!rut && t === rut)
  )
}

export async function leerInforme(archivo: Blob): Promise<InformeLeido> {
  const tarea = getDocument({ data: new Uint8Array(await archivo.arrayBuffer()) })
  const pdf = await tarea.promise
  const informe: InformeLeido = { domicilios: [], relacionados: [], conNotas: false }
  let seccion: ReturnType<typeof seccionDe> = null
  let columnas: { rut: number; nombre: number; relacion: number } | null = null

  try {
    for (let n = 1; n <= pdf.numPages; n++) {
      const pagina = await pdf.getPage(n)
      const { lineas, etiquetas } = await leerLineas(pagina)

      // Cabecera de la primera página: nombre del titular y su RUT
      if (n === 1) {
        const iRut = lineas.findIndex((l) => RUT.test(l.texto))
        if (iRut >= 0 && iRut <= 3) {
          informe.rutTitular = lineas[iRut].texto
          if (iRut > 0) informe.titular = lineas[iRut - 1].texto
        }
        const todo = lineas.map((l) => l.texto).join(' ')
        informe.fechaConsulta = todo.match(/Fecha Consulta\s*:?\s*(\d{2}-\d{2}-\d{4})/i)?.[1]
        informe.fuente = todo.match(/Fte\.?\s*Proveedora\s*:?\s*([A-Za-zÁÉÍÓÚÑáéíóúñ]+)/i)?.[1]
      }

      // Domicilios de esta página (para asignarles sus notas)
      const domPagina: { d: DomicilioInforme; y: number }[] = []
      for (const l of lineas) {
        const s = seccionDe(l.texto)
        if (s) {
          seccion = s
          columnas = null
          continue
        }
        if (esPieOCabecera(l.texto, informe.titular, informe.rutTitular)) continue

        if (seccion === 'Más probable' || seccion === 'Alternativo' || seccion === 'Laboral') {
          // Solo el texto de la izquierda (a la derecha están las estrellas y avisos)
          const izquierda = l.items
            .filter((i) => !normalizar(i.texto).startsWith('no se registra'))
            .map((i) => i.texto)
            .join(' ')
            .trim()
          if (!izquierda || normalizar(izquierda) === 'residencia') continue
          const actual = domPagina[domPagina.length - 1]?.d
          const relacion = izquierda.match(/^relaci[oó]n directa con\s*(.*)$/i)
          if (relacion && actual) actual.relacion = relacion[1].trim()
          else if (actual && !actual.comuna && (izquierda.match(/,/g)?.length ?? 0) >= 2) actual.comuna = izquierda
          else {
            const d: DomicilioInforme = { direccion: izquierda, seccion, puntaje: 0 }
            informe.domicilios.push(d)
            domPagina.push({ d, y: l.y })
          }
        } else if (seccion === 'relacionados') {
          const t = l.items.map((i) => normalizar(i.texto))
          if (t.includes('rut') && t.includes('nombre')) {
            const x = (nombre: string) => l.items[t.indexOf(nombre)]?.x ?? 0
            columnas = { rut: x('rut'), nombre: x('nombre'), relacion: x(t.find((v) => v.startsWith('relaci')) ?? 'relacion') }
            continue
          }
          if (!columnas) continue
          const fila = { rut: [] as string[], nombre: [] as string[], relacion: [] as string[] }
          for (const it of l.items) {
            const cercana = (['rut', 'nombre', 'relacion'] as const).reduce((a, b) => (Math.abs(it.x - columnas![b]) < Math.abs(it.x - columnas![a]) ? b : a))
            fila[cercana].push(it.texto)
          }
          const rut = fila.rut.join('').trim()
          if (RUT.test(rut) && fila.nombre.length) {
            informe.relacionados.push({ rut, nombre: fila.nombre.join(' ').trim(), relacion: fila.relacion.join(' ').trim() })
          }
        }
      }

      // Notas: cada etiqueta "Contactabilidad" o "Calidad" se une con su fila de estrellas
      // y con el domicilio que empieza a esa altura o justo arriba
      if (etiquetas.length && domPagina.length) {
        const filas = await leerEstrellas(pagina)
        for (const e of etiquetas) {
          const fila = filas.reduce<{ y: number; nota: number } | null>((m, f) => (Math.abs(f.y - e.y) < 9 && (!m || Math.abs(f.y - e.y) < Math.abs(m.y - e.y)) ? f : m), null)
          if (!fila) continue
          const candidatos = domPagina.filter((p) => p.y >= e.y - 6).sort((a, b) => a.y - b.y)
          const dueño = candidatos[0]?.d
          if (!dueño) continue
          dueño[e.tipo] = fila.nota
          informe.conNotas = true
        }
      }
    }
  } finally {
    await tarea.destroy()
  }

  for (const d of informe.domicilios) d.puntaje = (d.contactabilidad ?? 0) + (d.calidad ?? 0)
  // Más probables primero: mayor puntaje; a igual puntaje, el orden de las secciones del informe
  const orden: Record<SeccionDomicilio, number> = { 'Más probable': 0, Alternativo: 1, Laboral: 2 }
  informe.domicilios.sort((a, b) => b.puntaje - a.puntaje || orden[a.seccion] - orden[b.seccion])
  return informe
}

// Herramientas para comparar textos sin importar tildes, mayúsculas ni signos.

/** Quita tildes, pasa a minúsculas y deja un solo espacio entre palabras */
export function normalizar(texto: string | undefined | null): string {
  return (texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** true si "texto" contiene lo buscado (sin importar tildes ni mayúsculas) */
export function contiene(texto: string | undefined | null, buscado: string): boolean {
  const b = normalizar(buscado)
  if (!b) return true
  return normalizar(texto).includes(b)
}

// Palabras que no ayudan a distinguir un estudio de otro
const PALABRAS_COMUNES = new Set([
  'estudio', 'juridico', 'abogados', 'abogado', 'asociados', 'y', 'cia', 'ltda', 'limitada',
  'spa', 's', 'a', 'sa', 'eirl', 'de', 'del', 'la', 'los', 'las', 'el',
])

/** Nombre reducido a lo esencial, para detectar clientes parecidos ("Estudio Pérez Ltda." → "perez") */
export function nucleoNombre(nombre: string): string {
  return normalizar(nombre)
    .split(' ')
    .filter((p) => p && !PALABRAS_COMUNES.has(p))
    .join(' ')
}

/** Distancia de edición entre dos textos (cuántas letras hay que cambiar para pasar de uno a otro) */
export function distancia(a: string, b: string): number {
  if (a === b) return 0
  const fila = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let anterior = fila[0]
    fila[0] = i
    for (let j = 1; j <= b.length; j++) {
      const temporal = fila[j]
      fila[j] = Math.min(fila[j] + 1, fila[j - 1] + 1, anterior + (a[i - 1] === b[j - 1] ? 0 : 1))
      anterior = temporal
    }
  }
  return fila[b.length]
}

/** true si dos nombres de cliente parecen ser el mismo */
export function nombresParecidos(a: string, b: string): boolean {
  const na = nucleoNombre(a)
  const nb = nucleoNombre(b)
  if (!na || !nb) return false
  if (na === nb) return true
  if (na.length >= 4 && nb.length >= 4 && (na.includes(nb) || nb.includes(na))) return true
  const largo = Math.max(na.length, nb.length)
  return largo >= 5 && distancia(na, nb) <= Math.floor(largo / 5)
}

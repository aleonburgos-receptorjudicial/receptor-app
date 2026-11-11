// Patentes chilenas (placas únicas): validar y dar formato.
// Formatos aceptados:
//   - Auto, formato nuevo (desde 2007): 4 letras + 2 números → BB·BB·12 (solo consonantes, sin M, N, Ñ ni Q)
//   - Auto, formato antiguo: 2 letras + 4 números → AB·12·34
//   - Moto, formato nuevo: 3 letras + 2 números → BBB·12
//   - Moto, formato antiguo: 2 letras + 3 números → AB·123

const CONSONANTES = '[BCDFGHJKLPRSTVWXYZ]'
const FORMATOS: { patron: RegExp; formato: (p: string) => string; tipo: string }[] = [
  { patron: new RegExp(`^${CONSONANTES}{4}\\d{2}$`), formato: (p) => `${p.slice(0, 2)}·${p.slice(2, 4)}·${p.slice(4)}`, tipo: 'auto' },
  { patron: /^[A-Z]{2}\d{4}$/, formato: (p) => `${p.slice(0, 2)}·${p.slice(2, 4)}·${p.slice(4)}`, tipo: 'auto' },
  { patron: new RegExp(`^${CONSONANTES}{3}\\d{2}$`), formato: (p) => `${p.slice(0, 3)}·${p.slice(3)}`, tipo: 'moto' },
  { patron: /^[A-Z]{2}\d{3}$/, formato: (p) => `${p.slice(0, 2)}·${p.slice(2)}`, tipo: 'moto' },
]

/** Deja solo letras y números, en mayúscula: "bb-bb 12" → "BBBB12" */
export function limpiarPatente(p: string): string {
  return p
    .toUpperCase()
    .normalize('NFD')
    .replace(/[^A-Z0-9]/g, '')
}

export function patenteValida(p: string): boolean {
  const l = limpiarPatente(p)
  return FORMATOS.some((f) => f.patron.test(l))
}

/** Patente con el formato de la placa: "BBBB12" → "BB·BB·12". Si no es válida, la devuelve limpia. */
export function formatearPatente(p: string): string {
  const l = limpiarPatente(p)
  const f = FORMATOS.find((x) => x.patron.test(l))
  return f ? f.formato(l) : l
}

/** Revisa una patente escrita por la usuaria. Vacía es válida (el campo puede quedar en blanco). */
export function revisarPatente(p: string | undefined): { valor?: string; error?: string } {
  if (!p || !p.trim()) return {}
  if (!patenteValida(p)) {
    return { error: 'La patente no tiene un formato chileno válido. Ejemplos: BBBB12, AB1234 o, para motos, BBB12.' }
  }
  return { valor: formatearPatente(p) }
}

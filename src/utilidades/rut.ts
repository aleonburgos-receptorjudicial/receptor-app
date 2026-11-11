// Herramientas para el RUT chileno: limpiar, validar el dígito verificador y dar formato 12.345.678-9.

/** Deja solo números y la K final, en mayúscula */
export function limpiarRut(rut: string): string {
  return rut.replace(/[^0-9kK]/g, '').toUpperCase()
}

/** Calcula el dígito verificador de un número de RUT (módulo 11) */
export function calcularDv(cuerpo: string): string {
  let suma = 0
  let multiplicador = 2
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * multiplicador
    multiplicador = multiplicador === 7 ? 2 : multiplicador + 1
  }
  const resto = 11 - (suma % 11)
  if (resto === 11) return '0'
  if (resto === 10) return 'K'
  return String(resto)
}

/** true si el RUT tiene un dígito verificador correcto */
export function rutValido(rut: string): boolean {
  const limpio = limpiarRut(rut)
  if (limpio.length < 2) return false
  const cuerpo = limpio.slice(0, -1)
  const dv = limpio.slice(-1)
  if (!/^\d+$/.test(cuerpo)) return false
  return calcularDv(cuerpo) === dv
}

/** Da formato 12.345.678-9. Si el texto no parece RUT, lo devuelve tal cual. */
export function formatearRut(rut: string): string {
  const limpio = limpiarRut(rut)
  if (limpio.length < 2) return rut.trim()
  const cuerpo = limpio.slice(0, -1)
  const dv = limpio.slice(-1)
  if (!/^\d+$/.test(cuerpo)) return rut.trim()
  const conPuntos = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${conPuntos}-${dv}`
}

/**
 * Revisa un RUT escrito por la usuaria.
 * Devuelve el RUT con formato o un mensaje de error. Un RUT vacío es válido (el campo es opcional).
 */
export function revisarRut(rut: string | undefined): { valor?: string; error?: string } {
  if (!rut || !rut.trim()) return { valor: undefined }
  if (!rutValido(rut)) return { error: 'El RUT no es válido. Revise los números y el dígito verificador.' }
  return { valor: formatearRut(rut) }
}

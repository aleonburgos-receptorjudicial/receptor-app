// Antecedentes: la app aprende de las diligencias ya hechas.
// Cada diligencia realizada (o con observaciones) deja un antecedente asociado a su domicilio y a su demandado.
// Cuando aparece otra diligencia en el mismo domicilio, o al mismo demandado, se muestran esos antecedentes.
// Todo se calcula con los datos del equipo: nada se envía afuera.
import type { Causa } from '../../db/tipos'
import { fechaCL } from '../../utilidades/formato'
import { limpiarRut } from '../../utilidades/rut'
import { distancia, normalizar } from '../../utilidades/texto'

// ---------- Domicilios: reconocer la misma dirección escrita de distinta forma ----------

const ABREVIATURAS: Record<string, string> = {
  av: 'avenida', avda: 'avenida', avd: 'avenida',
  pje: 'pasaje', psje: 'pasaje', pj: 'pasaje',
  pob: 'poblacion', pobl: 'poblacion',
  vla: 'villa',
  dpto: 'depto', dto: 'depto', departamento: 'depto',
  gral: 'general', pdte: 'presidente', sta: 'santa', sto: 'santo',
}
// Palabras que no cambian la dirección
// Tipos de vía que a veces se escriben y a veces no
const TIPOS_VIA = new Set(['avenida', 'pasaje', 'diagonal'])
const RELLENO = new Set(['n', 'no', 'nro', 'num', 'numero', 'calle', 'de', 'del', 'la', 'el', 'los', 'las', 'chile'])

export interface ClaveDomicilio {
  /** Calle y número normalizados ("avenida 4 norte 455") */
  calle: string
  /** Solo las palabras de la calle, sin números */
  nombre: string
  /** Números que aparecen (número de casa, pasaje, depto) */
  numeros: string[]
  /** Comuna o sector, si se escribió después de una coma */
  comuna?: string
}

export function claveDomicilio(d: string | undefined | null): ClaveDomicilio | null {
  if (!d) return null
  const [primera, ...resto] = d.split(',')
  const tokens = normalizar(primera)
    .replace(/(\d+)\s*([a-mo-z])\b/g, '$1$2') // "455 b" → "455b" (la "n" de "N°" no se junta)
    .split(' ')
    .filter(Boolean)
    .map((t) => ABREVIATURAS[t] ?? t)
    .filter((t) => !RELLENO.has(t))
  if (!tokens.length || normalizar(primera).startsWith('sin domicilio')) return null
  const numeros = tokens.filter((t) => /^\d/.test(t))
  const nombre = tokens.filter((t) => !/^\d/.test(t)).join(' ')
  const comuna = resto.map((x) => normalizar(x)).find((x) => x && x !== 'chile')
  return { calle: tokens.join(' '), nombre, numeros, comuna }
}

/** true si dos domicilios parecen el mismo (tolera abreviaturas, tildes y pequeñas faltas de ortografía) */
export function mismoDomicilio(a: ClaveDomicilio | null, b: ClaveDomicilio | null): boolean {
  if (!a || !b) return false
  // Si ambos dicen la comuna y no coinciden, no es el mismo lugar
  if (a.comuna && b.comuna && a.comuna !== b.comuna && !a.comuna.includes(b.comuna) && !b.comuna.includes(a.comuna)) return false
  if (a.calle === b.calle) return true
  // Mismos números y nombre de calle casi igual ("Avenida" y "Pasaje" son opcionales si el nombre coincide)
  if (!a.numeros.length || a.numeros.join(' ') !== b.numeros.join(' ')) return false
  const parecidos = (x: string, y: string) => {
    const largo = Math.max(x.length, y.length)
    return largo >= 4 && distancia(x, y) <= Math.max(1, Math.floor(largo / 8))
  }
  if (parecidos(a.nombre, b.nombre)) return true
  const sinTipo = (n: string) => n.split(' ').filter((t) => !TIPOS_VIA.has(t)).join(' ')
  const [x, y] = [sinTipo(a.nombre), sinTipo(b.nombre)]
  return x.length >= 3 && y.length >= 3 && parecidos(x, y)
}

// ---------- Qué dicen las observaciones ----------

export type TipoAntecedente = 'no-existe' | 'no-vive' | 'deshabitado' | 'negativa' | 'precaucion' | 'positiva'

export const DESCRIPCION: Record<TipoAntecedente, { texto: string; negativo: boolean }> = {
  'no-existe': { texto: 'Domicilio no existe', negativo: true },
  'no-vive': { texto: 'El demandado no vive ahí', negativo: true },
  deshabitado: { texto: 'Sitio eriazo o deshabitado', negativo: true },
  negativa: { texto: 'Diligencia negativa', negativo: true },
  precaucion: { texto: 'Precaución en terreno', negativo: false },
  positiva: { texto: 'Diligencia positiva', negativo: false },
}

const PATRONES: [TipoAntecedente, RegExp][] = [
  ['no-existe', /(no existe|inexistente|numeracion no existe|no se ubic\w* (el )?domicilio|direccion (erronea|incorrecta|inexistente)|no hay numeracion|numero no existe)/],
  ['no-vive', /(no vive|no reside|ya no (vive|reside)|se cambio|se mudo|cambio de domicilio|desconocid|no lo conoc|no la conoc|no conocen|nuevo arrendatario|vendio la casa|domicilio anterior)/],
  ['deshabitado', /(eriazo|deshabitad|abandonad|sin moradores|nadie vive|casa vacia|en construccion|demolid)/],
  ['precaucion', /(perro|peligro|agresiv|amenaz|acceso dificil|camino malo|sin acceso|no se puede ingresar|condominio cerrado|porton cerrado)/],
]

/** Tipos de antecedente que se desprenden de una diligencia */
export function clasificar(c: Pick<Causa, 'observaciones' | 'detalleResultado' | 'resultado' | 'estado'>): TipoAntecedente[] {
  const texto = normalizar(`${c.detalleResultado ?? ''} ${c.observaciones ?? ''}`)
  const tipos = PATRONES.filter(([, re]) => re.test(texto)).map(([t]) => t)
  if (c.estado === 'Realizada' && c.resultado === 'Negativa' && !tipos.some((t) => DESCRIPCION[t].negativo)) tipos.push('negativa')
  if (c.estado === 'Realizada' && c.resultado === 'Positiva' && !tipos.some((t) => DESCRIPCION[t].negativo)) tipos.push('positiva')
  return tipos
}

// ---------- Índice de antecedentes ----------

export interface Antecedente {
  causaId: number
  rol: string
  fecha: string
  domicilio?: string
  demandado?: string
  rutDemandado?: string
  tipos: TipoAntecedente[]
  resultado?: string
  observaciones?: string
  clave: ClaveDomicilio | null
}

/** Arma la lista de antecedentes a partir de las causas (las más recientes primero) */
export function construirAntecedentes(causas: Causa[]): Antecedente[] {
  return causas
    .map((c) => ({ c, tipos: clasificar(c) }))
    .filter(({ c, tipos }) => tipos.length > 0 && (c.estado === 'Realizada' || tipos.some((t) => t !== 'positiva')))
    .map(({ c, tipos }) => ({
      causaId: c.id!,
      rol: c.rol,
      fecha: (c.fechaDiligencia ?? c.actualizado ?? c.fechaEncargo).slice(0, 10),
      domicilio: c.domicilio,
      demandado: c.demandado,
      rutDemandado: c.rutDemandado,
      tipos,
      resultado: [c.resultado, c.detalleResultado].filter(Boolean).join(', ') || undefined,
      observaciones: c.observaciones,
      clave: claveDomicilio(c.domicilio),
    }))
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
}

/** Antecedentes del mismo domicilio (sin contar la propia causa) */
export function antecedentesDomicilio(lista: Antecedente[], domicilio: string | undefined, excluirId?: number): Antecedente[] {
  const clave = claveDomicilio(domicilio)
  if (!clave) return []
  return lista.filter((a) => a.causaId !== excluirId && mismoDomicilio(a.clave, clave))
}

/** Antecedentes del mismo demandado en OTROS domicilios (por RUT o nombre completo) */
export function antecedentesDemandado(lista: Antecedente[], rut: string | undefined, nombre: string | undefined, domicilio: string | undefined, excluirId?: number): Antecedente[] {
  const r = rut ? limpiarRut(rut) : ''
  const n = normalizar(nombre)
  if (!r && n.split(' ').length < 2) return []
  const clave = claveDomicilio(domicilio)
  return lista.filter(
    (a) =>
      a.causaId !== excluirId &&
      ((r && a.rutDemandado && limpiarRut(a.rutDemandado) === r) || (!!n && normalizar(a.demandado) === n)) &&
      !mismoDomicilio(a.clave, clave),
  )
}

/** El antecedente que más importa mostrar: el más reciente; si es negativo, se destaca */
export function resumenAntecedentes(lista: Antecedente[]): { texto: string; negativo: boolean; ultimo: Antecedente } | null {
  const ultimo = lista[0]
  if (!ultimo) return null
  const tipo = ultimo.tipos.find((t) => DESCRIPCION[t].negativo) ?? ultimo.tipos[0]
  return { texto: DESCRIPCION[tipo].texto, negativo: DESCRIPCION[tipo].negativo, ultimo }
}

/** Texto corto para listas y PDF: "Domicilio no existe (C-402-2026, 06-11-2026)" */
export function textoCorto(lista: Antecedente[]): string | null {
  const r = resumenAntecedentes(lista)
  if (!r) return null
  return `${r.texto} (${r.ultimo.rol}, ${fechaCL(r.ultimo.fecha)})${lista.length > 1 ? ` y ${lista.length - 1} más` : ''}`
}


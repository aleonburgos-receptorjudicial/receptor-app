// Mandantes (bancos, financieras, cooperativas…): lista editable para causas y retiros.
// Renombrar un mandante corrige su nombre en todas las causas y retiros que lo usan.
import { ahoraISO, db } from '../../db/basedatos'
import { guardarAjustes, leerAjustes } from '../../db/ajustes'
import type { Causa, Retiro } from '../../db/tipos'
import { normalizar } from '../../utilidades/texto'

export interface UsoMandante {
  nombre: string
  causas: number
  retiros: number
  enLista: boolean
}

/** Une la lista guardada con los mandantes que aparecen en causas y retiros, y cuenta sus usos */
export function mandantesConUso(lista: string[], causas: Causa[], retiros: Retiro[]): UsoMandante[] {
  const mapa = new Map<string, UsoMandante>()
  const tomar = (nombre: string | undefined, enLista = false) => {
    const t = nombre?.trim()
    if (!t) return undefined
    const clave = normalizar(t)
    let u = mapa.get(clave)
    if (!u) {
      u = { nombre: t, causas: 0, retiros: 0, enLista }
      mapa.set(clave, u)
    }
    if (enLista) {
      u.enLista = true
      u.nombre = t // el nombre escrito en la lista manda
    }
    return u
  }
  lista.forEach((m) => tomar(m, true))
  causas.forEach((c) => {
    const u = tomar(c.mandante)
    if (u) u.causas++
  })
  retiros.forEach((r) => {
    const u = tomar(r.mandante)
    if (u) u.retiros++
  })
  return [...mapa.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}

/** Agrega a la lista los mandantes que todavía no estén (sin importar tildes ni mayúsculas) */
export async function recordarMandantes(nombres: (string | undefined)[]): Promise<void> {
  const a = await leerAjustes()
  const conocidos = new Set(a.mandantes.map(normalizar))
  const nuevos: string[] = []
  for (const n of nombres) {
    const t = n?.trim()
    if (t && !conocidos.has(normalizar(t))) {
      conocidos.add(normalizar(t))
      nuevos.push(t)
    }
  }
  if (nuevos.length) await guardarAjustes({ mandantes: [...a.mandantes, ...nuevos] })
}

/**
 * Cambia el nombre de un mandante en la lista y en todas las causas y retiros.
 * Si el nombre nuevo ya existe, ambos quedan unidos bajo el nombre nuevo.
 * Devuelve cuántos registros se corrigieron.
 */
export async function renombrarMandante(viejo: string, nuevo: string): Promise<number> {
  const v = normalizar(viejo)
  const n = nuevo.trim()
  if (!n) return 0
  let cambiados = 0
  const ahora = ahoraISO()
  await db.transaction('rw', db.causas, db.retiros, async () => {
    cambiados += await db.causas.filter((c) => normalizar(c.mandante) === v).modify({ mandante: n, actualizado: ahora })
    cambiados += await db.retiros.filter((r) => normalizar(r.mandante) === v).modify({ mandante: n, actualizado: ahora })
  })
  const a = await leerAjustes()
  const lista = a.mandantes.filter((m) => normalizar(m) !== v && normalizar(m) !== normalizar(n))
  await guardarAjustes({ mandantes: [...lista, n] })
  return cambiados
}

/** Quita un mandante de la lista (las causas y retiros que lo usan no cambian) */
export async function quitarMandante(nombre: string): Promise<void> {
  const a = await leerAjustes()
  await guardarAjustes({ mandantes: a.mandantes.filter((m) => normalizar(m) !== normalizar(nombre)) })
}

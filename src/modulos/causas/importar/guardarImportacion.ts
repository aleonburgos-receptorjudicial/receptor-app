// Guarda en la base de datos lo que la usuaria confirmó en la vista previa de importación.
import { ahoraISO, db } from '../../../db/basedatos'
import { guardarAjustes, leerAjustes } from '../../../db/ajustes'
import type { Ajustes } from '../../../db/tipos'
import { normalizar } from '../../../utilidades/texto'
import { guardarVariasCausas, registrarReencargo } from '../servicioCausas'
import type { FilaAnalizada } from './analizarFilas'

export interface ListasLeidas {
  diligencias: string[]
  resultados: string[]
  sectores: string[]
  clientes: string[]
  tiposCausa: string[]
}

export interface ResultadoImportacion {
  nuevas: number
  reencargos: number
  clientesCreados: number
}

/** Une dos listas sin repetir (sin importar tildes ni mayúsculas) */
export function unirListas(base: string[], extra: string[]): string[] {
  const vistos = new Set(base.map(normalizar))
  const resultado = [...base]
  for (const v of extra) {
    const t = v.trim()
    if (t && !vistos.has(normalizar(t))) {
      vistos.add(normalizar(t))
      resultado.push(t)
    }
  }
  return resultado
}

export async function guardarImportacion(
  filas: FilaAnalizada[],
  listas: { datos: ListasLeidas; agregarListas: boolean; crearClientesLista: boolean } | null,
): Promise<ResultadoImportacion> {
  const nuevas = filas.filter((f) => f.accion === 'nueva')
  const reencargos = filas.filter((f) => f.accion === 'reencargo' && f.existenteId)
  let clientesCreados = 0

  // 1. Listas de la hoja "Listas"
  if (listas?.agregarListas) {
    const a = await leerAjustes()
    const cambios: Partial<Ajustes> = {
      tiposDiligencia: unirListas(a.tiposDiligencia, listas.datos.diligencias),
      detallesResultado: unirListas(a.detallesResultado, listas.datos.resultados),
      sectores: unirListas(a.sectores, listas.datos.sectores),
      tiposCausa: unirListas(a.tiposCausa, listas.datos.tiposCausa),
    }
    await guardarAjustes(cambios)
  }

  // 2. Clientes que todavía no existen
  const clientes = await db.clientes.toArray()
  const idPorNombre = new Map(clientes.map((c) => [normalizar(c.nombre), c.id!]))
  const nombresNecesarios = new Set<string>()
  for (const f of nuevas) if (f.nombreCliente && !f.datos.clienteId) nombresNecesarios.add(f.nombreCliente.trim())
  if (listas?.crearClientesLista) listas.datos.clientes.forEach((c) => nombresNecesarios.add(c.trim()))
  const ahora = ahoraISO()
  for (const nombre of nombresNecesarios) {
    if (!nombre || idPorNombre.has(normalizar(nombre))) continue
    const id = (await db.clientes.add({ nombre, creado: ahora, actualizado: ahora })) as number
    idPorNombre.set(normalizar(nombre), id)
    clientesCreados++
  }

  // 3. Causas nuevas
  await guardarVariasCausas(
    nuevas.map((f) => ({
      ...f.datos,
      clienteId: f.datos.clienteId ?? (f.nombreCliente ? idPorNombre.get(normalizar(f.nombreCliente)) : undefined),
    })),
  )

  // 4. Reencargos
  for (const f of reencargos) {
    await registrarReencargo(f.existenteId!, { fecha: f.datos.fechaEncargo, domicilio: f.datos.domicilio, nota: f.datos.observaciones })
  }

  return { nuevas: nuevas.length, reencargos: reencargos.length, clientesCreados }
}

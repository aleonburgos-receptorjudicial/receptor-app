// Empresas de la usuaria que emiten facturas (lista guardada en los ajustes).
import { guardarAjustes, leerAjustes } from '../../db/ajustes'
import type { Empresa } from '../../db/tipos'
import { limpiarRut, revisarRut } from '../../utilidades/rut'

export const mismaEmpresa = (a?: string, b?: string) => !!a && !!b && limpiarRut(a) === limpiarRut(b)

/** Busca una empresa por RUT */
export function buscarEmpresa(empresas: Empresa[], rut?: string): Empresa | undefined {
  return empresas.find((e) => mismaEmpresa(e.rut, rut))
}

/** Agrega una empresa (o le pone nombre si ya existía sin él). Devuelve el error si el RUT no es válido. */
export async function agregarEmpresa(nombre: string, rut: string): Promise<{ error?: string; empresa?: Empresa }> {
  const r = revisarRut(rut)
  if (!rut.trim()) return { error: 'Escriba el RUT de la empresa.' }
  if (r.error || !r.valor) return { error: r.error ?? 'El RUT no es válido.' }
  if (!nombre.trim()) return { error: 'Escriba el nombre de la empresa.' }
  const empresa = { nombre: nombre.trim(), rut: r.valor }
  const a = await leerAjustes()
  const existente = buscarEmpresa(a.empresas, r.valor)
  if (existente) return { empresa: existente }
  await guardarAjustes({ empresas: [...a.empresas, empresa] })
  return { empresa }
}

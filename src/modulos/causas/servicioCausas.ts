// Operaciones del módulo Causas: validar, guardar, evitar duplicados, marcar realizada y reencargos.
import { ahoraISO, db } from '../../db/basedatos'
import { guardarAjustes, leerAjustes } from '../../db/ajustes'
import type { Ajustes, Causa, ResultadoDiligencia } from '../../db/tipos'
import { fechaCL, hoyISO } from '../../utilidades/formato'
import { revisarRut } from '../../utilidades/rut'
import { normalizar } from '../../utilidades/texto'

export type DatosCausa = Omit<Causa, 'id' | 'creado' | 'actualizado' | 'ejemplo'>

/** ROL en mayúsculas, sin espacios y con guiones normales: "c - 512 - 2026" → "C-512-2026" */
export function normalizarRol(rol: string): string {
  return rol
    .toUpperCase()
    .replace(/[‐-―−]/g, '-')
    .replace(/\s+/g, '')
    .trim()
}

/** ROL sin la letra inicial: "E-268-2026" → "268-2026" (para comparar con archivos que no traen la letra) */
export function nucleoRol(rol: string): string {
  return normalizarRol(rol).replace(/^[A-Z]+-/, '')
}

export type ErroresCausa = Partial<Record<keyof DatosCausa, string>>

/** Revisa los datos del formulario y los deja limpios */
export function validarCausa(datos: DatosCausa): { errores: ErroresCausa; datos: DatosCausa } {
  const errores: ErroresCausa = {}
  const texto = (v?: string) => v?.trim() || undefined
  const limpio: DatosCausa = {
    ...datos,
    rol: normalizarRol(datos.rol ?? ''),
    tribunal: datos.tribunal?.trim() || '',
    mandante: texto(datos.mandante),
    demandado: texto(datos.demandado),
    domicilio: texto(datos.domicilio),
    sector: texto(datos.sector),
    tipoDiligencia: texto(datos.tipoDiligencia),
    observaciones: texto(datos.observaciones),
    detalleResultado: texto(datos.detalleResultado),
    fechaDiligencia: datos.fechaDiligencia || undefined,
  }
  if (!limpio.rol) errores.rol = 'Escriba el ROL de la causa. Ejemplo: C-512-2026'
  if (!limpio.tribunal) errores.tribunal = 'Indique el tribunal.'
  if (!limpio.fechaEncargo) errores.fechaEncargo = 'Indique la fecha de encargo.'
  else if (limpio.fechaEncargo > hoyISO()) errores.fechaEncargo = 'La fecha de encargo no puede ser posterior a hoy.'
  if (limpio.fechaDiligencia && limpio.fechaEncargo && limpio.fechaDiligencia < limpio.fechaEncargo) {
    errores.fechaDiligencia = 'La fecha de diligencia no puede ser anterior a la del encargo.'
  }
  const rut = revisarRut(datos.rutDemandado)
  if (rut.error) errores.rutDemandado = rut.error
  limpio.rutDemandado = rut.valor
  if (limpio.estado === 'Realizada' && !limpio.fechaDiligencia) {
    errores.fechaDiligencia = 'Para una causa realizada, indique la fecha de diligencia.'
  }
  return { errores, datos: limpio }
}

/** Busca otra causa con el mismo ROL, la misma fecha de encargo y el mismo cliente */
export async function buscarDuplicado(datos: Pick<Causa, 'rol' | 'fechaEncargo' | 'clienteId'>, excluirId?: number): Promise<Causa | undefined> {
  const rol = normalizarRol(datos.rol)
  const candidatas = await db.causas.where('rol').equals(rol).toArray()
  return candidatas.find((c) => c.id !== excluirId && c.fechaEncargo === datos.fechaEncargo && (c.clienteId ?? null) === (datos.clienteId ?? null))
}

/** Agrega a las listas de Configuración los valores nuevos que se escribieron a mano */
async function recordarValoresNuevos(datos: Partial<Causa>[]): Promise<void> {
  const ajustes = await leerAjustes()
  const agregar = (lista: string[], valores: (string | undefined)[]) => {
    const conocidos = new Set(lista.map(normalizar))
    const nuevos: string[] = []
    for (const v of valores) {
      if (v && !conocidos.has(normalizar(v))) {
        conocidos.add(normalizar(v))
        nuevos.push(v)
      }
    }
    return nuevos.length ? [...lista, ...nuevos] : null
  }
  const cambios: Partial<Ajustes> = {}
  const dil = agregar(ajustes.tiposDiligencia, datos.map((d) => d.tipoDiligencia))
  const sec = agregar(ajustes.sectores, datos.map((d) => d.sector))
  const tip = agregar(ajustes.tiposCausa, datos.map((d) => d.tipoCausa))
  const det = agregar(ajustes.detallesResultado, datos.map((d) => d.detalleResultado))
  if (dil) cambios.tiposDiligencia = dil
  if (sec) cambios.sectores = sec
  if (tip) cambios.tiposCausa = tip
  if (det) cambios.detallesResultado = det
  if (Object.keys(cambios).length) await guardarAjustes(cambios)
}

export async function guardarCausa(datos: DatosCausa, id?: number): Promise<number> {
  const ahora = ahoraISO()
  let nuevoId = id
  if (id) {
    await db.causas.update(id, { ...datos, actualizado: ahora })
  } else {
    nuevoId = (await db.causas.add({ ...datos, creado: ahora, actualizado: ahora })) as number
  }
  await recordarValoresNuevos([datos])
  return nuevoId!
}

/** Guarda varias causas de una vez (importación) */
export async function guardarVariasCausas(lista: DatosCausa[]): Promise<void> {
  const ahora = ahoraISO()
  await db.causas.bulkAdd(lista.map((d) => ({ ...d, creado: ahora, actualizado: ahora })))
  await recordarValoresNuevos(lista)
}

export async function eliminarCausa(id: number): Promise<void> {
  await db.causas.delete(id)
}

export interface DatosRealizada {
  fechaDiligencia: string
  resultado: ResultadoDiligencia
  detalleResultado?: string
  observaciones?: string
  estampadoPjud: boolean
}

/** Marca una causa como realizada, con fecha, resultado y observaciones en un solo paso */
export async function marcarRealizada(id: number, d: DatosRealizada): Promise<void> {
  await db.causas.update(id, {
    estado: 'Realizada',
    fechaDiligencia: d.fechaDiligencia,
    resultado: d.resultado,
    detalleResultado: d.detalleResultado || undefined,
    observaciones: d.observaciones?.trim() || undefined,
    estampadoPjud: d.estampadoPjud,
    actualizado: ahoraISO(),
  })
  if (d.detalleResultado) await recordarValoresNuevos([{ detalleResultado: d.detalleResultado }])
}

/** Registra un reencargo: nueva fecha de encargo, vuelve a Pendiente y guarda la fecha anterior */
export async function registrarReencargo(id: number, nueva: { fecha: string; domicilio?: string; nota?: string }): Promise<void> {
  const causa = await db.causas.get(id)
  if (!causa) return
  const notas: string[] = []
  if (causa.observaciones) notas.push(causa.observaciones)
  notas.push(`Reencargo ${fechaCL(nueva.fecha)} (encargo anterior ${fechaCL(causa.fechaEncargo)})`)
  const cambiaDomicilio = !!nueva.domicilio && normalizar(nueva.domicilio) !== normalizar(causa.domicilio)
  if (cambiaDomicilio && causa.domicilio) notas.push(`Domicilio anterior: ${causa.domicilio}`)
  if (nueva.nota) notas.push(nueva.nota)
  await db.causas.update(id, {
    fechaEncargo: nueva.fecha,
    fechasAnteriores: [...(causa.fechasAnteriores ?? []), causa.fechaEncargo],
    reencargo: true,
    estado: causa.estado === 'Suspendida' || causa.estado === 'Devuelta' ? causa.estado : 'Pendiente',
    domicilio: cambiaDomicilio ? nueva.domicilio : causa.domicilio,
    observaciones: notas.join('\n'),
    actualizado: ahoraISO(),
  })
}

/** Qué falta en una causa realizada: estampar, emitir boleta, o nada */
export function etapaCausa(c: Causa): { texto: string; falta: boolean } | null {
  if (c.estado !== 'Realizada') return null
  if (!c.estampadoPjud) return { texto: 'Falta estampar en PJUD', falta: true }
  if (!c.boletaId) return { texto: 'Estampada, sin boleta', falta: true }
  return { texto: 'Boleta emitida', falta: false }
}

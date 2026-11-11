// Operaciones del módulo Retiros de vehículos: validar, guardar, eliminar y registrar el retiro.
import { ahoraISO, db } from '../../db/basedatos'
import type { CampoRetiro, Retiro } from '../../db/tipos'
import { hoyISO } from '../../utilidades/formato'
import { revisarPatente } from '../../utilidades/patente'
import { revisarRut } from '../../utilidades/rut'
import { normalizarRol } from '../causas/servicioCausas'
import { recordarMandantes } from '../clientes/servicioMandantes'

export type DatosRetiro = Omit<Retiro, 'id' | 'creado' | 'actualizado' | 'ejemplo'>
export type ValorExtra = string | number | boolean | null
/** Errores por clave de campo (base o personalizado) */
export type ErroresRetiro = Record<string, string | undefined>

/** Valor de un campo, sea de fábrica o personalizado */
export function valorCampo(r: Partial<DatosRetiro>, campo: CampoRetiro): ValorExtra | undefined {
  if (campo.base) return (r as Record<string, ValorExtra | undefined>)[campo.clave]
  return r.extras?.[campo.clave] ?? undefined
}

const vacio = (v: unknown) => v === undefined || v === null || (typeof v === 'string' && !v.trim())

/** Revisa el formulario según los campos configurados y deja los datos limpios */
export function validarRetiro(datos: DatosRetiro, campos: CampoRetiro[]): { errores: ErroresRetiro; datos: DatosRetiro } {
  const errores: ErroresRetiro = {}
  const t = (v?: string) => v?.trim() || undefined
  const limpio: DatosRetiro = {
    ...datos,
    rol: normalizarRol(datos.rol ?? ''),
    tribunal: datos.tribunal?.trim() ?? '',
    mandante: t(datos.mandante),
    deudor: t(datos.deudor),
    marca: t(datos.marca),
    modelo: t(datos.modelo),
    color: t(datos.color),
    direccion: t(datos.direccion),
    custodio: t(datos.custodio),
    horaRetiro: t(datos.horaRetiro),
    lugarRetiro: t(datos.lugarRetiro),
    revisionTecnica: t(datos.revisionTecnica),
    permisoCirculacion: t(datos.permisoCirculacion),
    martilleroNombre: t(datos.martilleroNombre),
    martilleroTelefono: t(datos.martilleroTelefono),
    martilleroDireccion: t(datos.martilleroDireccion),
    observaciones: t(datos.observaciones),
  }
  // Fechas vacías se guardan como "sin fecha"
  for (const f of ['fechaEmision', 'fechaFuerzaSolicitada', 'fechaFuerzaConcedida', 'fechaRetiro'] as const) limpio[f] = datos[f] || undefined

  if (!limpio.rol) errores.rol = 'Escriba el ROL de la causa.'
  if (!limpio.fechaEncargo) errores.fechaEncargo = 'Indique la fecha de encargo.'
  else if (limpio.fechaEncargo > hoyISO()) errores.fechaEncargo = 'La fecha de encargo no puede ser posterior a hoy.'
  if (!limpio.fechaEmision) errores.fechaEmision = 'Indique la fecha de emisión del oficio.'
  else if (limpio.fechaEmision > hoyISO()) errores.fechaEmision = 'La fecha de emisión no puede ser posterior a hoy.'
  if (!limpio.fechaVencimiento) errores.fechaVencimiento = 'La fecha de vencimiento del oficio es obligatoria.'
  else if (limpio.fechaEmision && limpio.fechaVencimiento < limpio.fechaEmision) {
    errores.fechaVencimiento = 'El vencimiento no puede ser anterior a la emisión del oficio.'
  }
  const rut = revisarRut(datos.rutDeudor)
  if (rut.error) errores.rutDeudor = rut.error
  limpio.rutDeudor = rut.valor
  const pat = revisarPatente(datos.patente)
  if (pat.error) errores.patente = pat.error
  limpio.patente = pat.valor
  if (datos.anio !== undefined && datos.anio !== null && !Number.isNaN(datos.anio)) {
    const max = new Date().getFullYear() + 1
    if (!Number.isInteger(datos.anio) || datos.anio < 1950 || datos.anio > max) errores.anio = `Escriba un año entre 1950 y ${max}.`
  } else {
    limpio.anio = undefined
  }
  if (limpio.fechaRetiro && limpio.fechaEncargo && limpio.fechaRetiro < limpio.fechaEncargo) {
    errores.fechaRetiro = 'La fecha del retiro no puede ser anterior al encargo.'
  }
  if (limpio.horaRetiro && !/^([01]?\d|2[0-3]):[0-5]\d$/.test(limpio.horaRetiro)) errores.horaRetiro = 'Escriba la hora como 14:30.'

  // Campos personalizados: limpiar textos y revisar los obligatorios
  const extras: Record<string, ValorExtra> = {}
  for (const [k, v] of Object.entries(datos.extras ?? {})) {
    if (typeof v === 'string') {
      if (v.trim()) extras[k] = v.trim()
    } else if (v !== null && v !== undefined && !(typeof v === 'number' && Number.isNaN(v))) extras[k] = v
  }
  limpio.extras = Object.keys(extras).length ? extras : undefined
  for (const c of campos) {
    if (!c.visible || !c.obligatorio || c.fijo) continue
    if (vacio(valorCampo(limpio, c))) errores[c.clave] = `Complete «${c.etiqueta}».`
  }
  return { errores, datos: limpio }
}

export async function guardarRetiro(datos: DatosRetiro, id?: number): Promise<number> {
  const ahora = ahoraISO()
  await recordarMandantes([datos.mandante])
  if (id) {
    // "put" reemplaza el registro completo, así los campos borrados quedan realmente vacíos
    const anterior = await db.retiros.get(id)
    await db.retiros.put({ ...datos, id, creado: anterior?.creado ?? ahora, actualizado: ahora, ejemplo: anterior?.ejemplo })
    return id
  }
  return (await db.retiros.add({ ...datos, creado: ahora, actualizado: ahora })) as number
}

/** Elimina el retiro junto con sus informes PDF adjuntos */
export async function eliminarRetiro(id: number): Promise<void> {
  await db.transaction('rw', db.retiros, db.archivos, async () => {
    await db.archivos.where('retiroId').equals(id).delete()
    await db.retiros.delete(id)
  })
}

/** Registra que el vehículo fue retirado: día, hora, lugar y depósito en un solo paso */
export async function registrarRetiro(id: number, d: { fecha: string; hora?: string; lugar?: string; custodio?: string; observaciones?: string }): Promise<void> {
  await db.retiros.update(id, {
    estado: 'Retirado',
    fechaRetiro: d.fecha,
    horaRetiro: d.hora?.trim() || undefined,
    lugarRetiro: d.lugar?.trim() || undefined,
    custodio: d.custodio?.trim() || undefined,
    observaciones: d.observaciones?.trim() || undefined,
    actualizado: ahoraISO(),
  })
}

/** Busca otro retiro con el mismo ROL y la misma patente (posible duplicado) */
export async function buscarRetiroDuplicado(datos: Pick<Retiro, 'rol' | 'patente'>, excluirId?: number): Promise<Retiro | undefined> {
  const mismos = await db.retiros.where('rol').equals(normalizarRol(datos.rol)).toArray()
  return mismos.find((r) => r.id !== excluirId && (r.patente ?? '') === (datos.patente ?? ''))
}

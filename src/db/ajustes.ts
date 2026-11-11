// Ajustes de la aplicación: valores por defecto, lectura y guardado.
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './basedatos'
import type { Ajustes, CampoRetiro } from './tipos'

export const TRIBUNAL_CURANILAHUE = 'Juzgado de Letras y Garantía de Curanilahue'

/** Campos de fábrica del formulario de retiros de vehículos */
export const CAMPOS_RETIRO_BASE: CampoRetiro[] = [
  { clave: 'rol', etiqueta: 'Causa ROL', tipo: 'texto', visible: true, base: true, obligatorio: true, fijo: true },
  { clave: 'tribunal', etiqueta: 'Tribunal', tipo: 'texto', visible: true, base: true },
  { clave: 'fechaEmision', etiqueta: 'Fecha de emisión del oficio', tipo: 'fecha', visible: true, base: true, obligatorio: true, fijo: true },
  { clave: 'fechaVencimiento', etiqueta: 'Fecha de vencimiento del oficio', tipo: 'fecha', visible: true, base: true, obligatorio: true, fijo: true },
  { clave: 'fechaEncargo', etiqueta: 'Fecha en que llegó el encargo', tipo: 'fecha', visible: true, base: true, obligatorio: true, fijo: true },
  { clave: 'estado', etiqueta: 'Estado', tipo: 'lista', visible: true, base: true, fijo: true },
  { clave: 'patente', etiqueta: 'Patente', tipo: 'texto', visible: true, base: true },
  { clave: 'marca', etiqueta: 'Marca', tipo: 'texto', visible: true, base: true },
  { clave: 'modelo', etiqueta: 'Modelo', tipo: 'texto', visible: true, base: true },
  { clave: 'color', etiqueta: 'Color', tipo: 'texto', visible: true, base: true },
  { clave: 'anio', etiqueta: 'Año', tipo: 'numero', visible: true, base: true },
  { clave: 'deudor', etiqueta: 'Nombre del demandado', tipo: 'texto', visible: true, base: true },
  { clave: 'rutDeudor', etiqueta: 'RUT del demandado', tipo: 'texto', visible: true, base: true },
  { clave: 'mandante', etiqueta: 'Mandante', tipo: 'texto', visible: true, base: true },
  { clave: 'clienteId', etiqueta: 'Estudio jurídico', tipo: 'lista', visible: true, base: true },
  { clave: 'martilleroNombre', etiqueta: 'Martillero: nombre', tipo: 'texto', visible: true, base: true },
  { clave: 'martilleroTelefono', etiqueta: 'Martillero: teléfono', tipo: 'texto', visible: true, base: true },
  { clave: 'martilleroDireccion', etiqueta: 'Martillero: dirección', tipo: 'texto', visible: true, base: true },
  { clave: 'revisionTecnica', etiqueta: 'Dónde sacó la revisión técnica', tipo: 'texto', visible: true, base: true },
  { clave: 'permisoCirculacion', etiqueta: 'Dónde sacó el permiso de circulación', tipo: 'texto', visible: true, base: true },
  { clave: 'direccion', etiqueta: 'Domicilios probables del vehículo', tipo: 'texto', visible: true, base: true },
  { clave: 'fuerzaPublicaSolicitada', etiqueta: 'Fuerza pública solicitada', tipo: 'sino', visible: true, base: true },
  { clave: 'fuerzaPublicaConcedida', etiqueta: 'Fuerza pública concedida', tipo: 'sino', visible: true, base: true },
  { clave: 'fechaRetiro', etiqueta: 'Fecha del retiro', tipo: 'fecha', visible: true, base: true },
  { clave: 'horaRetiro', etiqueta: 'Hora del retiro', tipo: 'texto', visible: true, base: true },
  { clave: 'lugarRetiro', etiqueta: 'Lugar del retiro', tipo: 'texto', visible: true, base: true },
  { clave: 'custodio', etiqueta: 'Depósito o custodio', tipo: 'texto', visible: true, base: true },
  { clave: 'observaciones', etiqueta: 'Observaciones', tipo: 'texto', visible: true, base: true },
]

export const AJUSTES_POR_DEFECTO: Ajustes = {
  tribunalPorDefecto: TRIBUNAL_CURANILAHUE,
  umbralesCausas: { reciente: 30, media: 45, alta: 60 },
  umbralesRetiros: { verde: 15, amarillo: 8 },
  diasPrioridadBusqueda: 10,
  diasAvisoRenovacion: 7,
  umbralesBoletas: { primera: 30, segunda: 60, tercera: 90 },
  // Tasa de retención de boletas de honorarios vigente en 2026 (Ley 21.133)
  porcentajeRetencion: 15.25,
  tiposCausa: ['Civil', 'Exhorto', 'Protección', 'Laboral'],
  mandantes: [],
  tiposDiligencia: [
    'Notificación',
    'Notificación personal',
    'Notificación art. 44',
    'Notificación art. 52',
    'Notificación por cédula',
    'Notificación y requerimiento de pago',
    'Requerimiento de pago',
    'Embargo',
    'Oposición al embargo',
    'Búsqueda',
  ],
  detallesResultado: [
    'Búsqueda positiva',
    'Búsqueda negativa',
    'Notificado personalmente',
    'Notificado art. 44',
    'Notificado por cédula',
    'Requerido de pago',
    'Embargo trabado',
    'No se ubicó domicilio',
    'Otro',
  ],
  sectores: ['Centro'],
  mediosPago: ['Transferencia', 'Depósito', 'Cheque', 'Efectivo'],
  camposRetiro: CAMPOS_RETIRO_BASE,
  modoOscuro: false,
  firmaCobro: 'Mercedes León Burgos — Receptora Judicial · Curanilahue',
  encabezadoHojaRuta: 'Mercedes Andrea León Burgos · Receptora Judicial · Curanilahue',
}

/**
 * Completa los ajustes guardados con los valores por defecto.
 * Los campos de fábrica del formulario de retiros se mantienen siempre (con el nombre, orden y visibilidad que eligió la usuaria).
 */
function completar(guardado?: Partial<Ajustes>): Ajustes {
  const a: Ajustes = { ...AJUSTES_POR_DEFECTO, ...(guardado ?? {}) }
  const fabrica = new Map(CAMPOS_RETIRO_BASE.map((c) => [c.clave, c]))
  const campos = a.camposRetiro
    .filter((c) => !c.base || fabrica.has(c.clave))
    .map((c) => {
      const f = fabrica.get(c.clave)
      return f ? { ...c, tipo: f.tipo, base: true, fijo: f.fijo, obligatorio: f.obligatorio, visible: f.fijo ? true : c.visible } : c
    })
  for (const f of CAMPOS_RETIRO_BASE) if (!campos.some((c) => c.clave === f.clave)) campos.push(f)
  return { ...a, camposRetiro: campos }
}

/** Lee los ajustes guardados, completando con los valores por defecto lo que falte */
export async function leerAjustes(): Promise<Ajustes> {
  const fila = await db.ajustes.get('general')
  return completar(fila?.valor)
}

/** Guarda solo los ajustes que se indiquen, manteniendo el resto */
export async function guardarAjustes(cambios: Partial<Ajustes>): Promise<void> {
  const actuales = await leerAjustes()
  await db.ajustes.put({ clave: 'general', valor: { ...actuales, ...cambios } })
}

/** Ajustes siempre actualizados para usar dentro de las pantallas */
export function useAjustes(): Ajustes {
  const fila = useLiveQuery(() => db.ajustes.get('general'), [])
  return completar(fila?.valor)
}

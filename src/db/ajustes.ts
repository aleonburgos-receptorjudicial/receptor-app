// Ajustes de la aplicación: valores por defecto, lectura y guardado.
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './basedatos'
import type { Ajustes, CampoRetiro } from './tipos'

export const TRIBUNAL_CURANILAHUE = 'Juzgado de Letras y Garantía de Curanilahue'

/** Campos de fábrica del formulario de retiros de vehículos */
export const CAMPOS_RETIRO_BASE: CampoRetiro[] = [
  { clave: 'rol', etiqueta: 'ROL', tipo: 'texto', visible: true, base: true, obligatorio: true },
  { clave: 'tribunal', etiqueta: 'Tribunal', tipo: 'texto', visible: true, base: true },
  { clave: 'mandante', etiqueta: 'Mandante', tipo: 'texto', visible: true, base: true },
  { clave: 'clienteId', etiqueta: 'Estudio jurídico', tipo: 'lista', visible: true, base: true },
  { clave: 'deudor', etiqueta: 'Nombre del deudor', tipo: 'texto', visible: true, base: true },
  { clave: 'rutDeudor', etiqueta: 'RUT del deudor', tipo: 'texto', visible: true, base: true },
  { clave: 'patente', etiqueta: 'Patente', tipo: 'texto', visible: true, base: true },
  { clave: 'marca', etiqueta: 'Marca', tipo: 'texto', visible: true, base: true },
  { clave: 'modelo', etiqueta: 'Modelo', tipo: 'texto', visible: true, base: true },
  { clave: 'anio', etiqueta: 'Año', tipo: 'numero', visible: true, base: true },
  { clave: 'color', etiqueta: 'Color', tipo: 'texto', visible: true, base: true },
  { clave: 'direccion', etiqueta: 'Dirección donde se ubicaría', tipo: 'texto', visible: true, base: true },
  { clave: 'fechaEncargo', etiqueta: 'Fecha de encargo', tipo: 'fecha', visible: true, base: true, obligatorio: true },
  { clave: 'fechaVencimiento', etiqueta: 'Fecha de vencimiento', tipo: 'fecha', visible: true, base: true, obligatorio: true },
  { clave: 'estado', etiqueta: 'Estado', tipo: 'lista', visible: true, base: true },
  { clave: 'fuerzaPublicaSolicitada', etiqueta: 'Fuerza pública solicitada', tipo: 'sino', visible: true, base: true },
  { clave: 'fechaFuerzaSolicitada', etiqueta: 'Fecha de solicitud de fuerza pública', tipo: 'fecha', visible: true, base: true },
  { clave: 'fuerzaPublicaConcedida', etiqueta: 'Fuerza pública concedida', tipo: 'sino', visible: true, base: true },
  { clave: 'fechaFuerzaConcedida', etiqueta: 'Fecha de concesión de fuerza pública', tipo: 'fecha', visible: true, base: true },
  { clave: 'custodio', etiqueta: 'Depósito o custodio', tipo: 'texto', visible: true, base: true },
  { clave: 'fechaRetiro', etiqueta: 'Fecha del retiro', tipo: 'fecha', visible: true, base: true },
  { clave: 'horaRetiro', etiqueta: 'Hora del retiro', tipo: 'texto', visible: true, base: true },
  { clave: 'observaciones', etiqueta: 'Observaciones', tipo: 'texto', visible: true, base: true },
]

export const AJUSTES_POR_DEFECTO: Ajustes = {
  tribunalPorDefecto: TRIBUNAL_CURANILAHUE,
  umbralesCausas: { reciente: 30, media: 45, alta: 60 },
  umbralesRetiros: { verde: 15, amarillo: 8 },
  umbralesBoletas: { primera: 30, segunda: 60, tercera: 90 },
  // Tasa de retención de boletas de honorarios vigente en 2026 (Ley 21.133)
  porcentajeRetencion: 15.25,
  tiposDiligencia: [
    'Notificación personal',
    'Notificación art. 44',
    'Notificación art. 52',
    'Requerimiento de pago',
    'Embargo',
    'Oposición al embargo',
    'Búsqueda',
  ],
  mediosPago: ['Transferencia', 'Depósito', 'Cheque', 'Efectivo'],
  camposRetiro: CAMPOS_RETIRO_BASE,
  modoOscuro: false,
  firmaCobro: 'Mercedes León Burgos — Receptora Judicial · Curanilahue',
}

/** Lee los ajustes guardados, completando con los valores por defecto lo que falte */
export async function leerAjustes(): Promise<Ajustes> {
  const fila = await db.ajustes.get('general')
  return { ...AJUSTES_POR_DEFECTO, ...(fila?.valor ?? {}) }
}

/** Guarda solo los ajustes que se indiquen, manteniendo el resto */
export async function guardarAjustes(cambios: Partial<Ajustes>): Promise<void> {
  const actuales = await leerAjustes()
  await db.ajustes.put({ clave: 'general', valor: { ...actuales, ...cambios } })
}

/** Ajustes siempre actualizados para usar dentro de las pantallas */
export function useAjustes(): Ajustes {
  const fila = useLiveQuery(() => db.ajustes.get('general'), [])
  return { ...AJUSTES_POR_DEFECTO, ...(fila?.valor ?? {}) }
}

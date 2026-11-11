// Tipos de datos de toda la aplicación.
// Las fechas se guardan como texto "AAAA-MM-DD" (formato interno) y se muestran como DD-MM-AAAA.
// Los montos se guardan en pesos enteros.

/** Campos comunes a todos los registros */
export interface RegistroBase {
  id?: number
  /** Fecha y hora de creación (ISO) */
  creado: string
  /** Fecha y hora de la última modificación (ISO) */
  actualizado: string
  /** true si es un dato de ejemplo (se puede borrar con un botón) */
  ejemplo?: boolean
}

export interface Cliente extends RegistroBase {
  nombre: string
  rut?: string
  contacto?: string
  correo?: string
  telefono?: string
  notas?: string
}

export type TipoCausa = 'Civil' | 'Exhorto'
export type OrigenEncargo = 'Tribunal' | 'Particular' | 'Corte Suprema'
export type EstadoCausa = 'Pendiente' | 'Realizada' | 'Suspendida'
export type ResultadoDiligencia = 'Positiva' | 'Negativa'

export interface Causa extends RegistroBase {
  rol: string
  tipoCausa: TipoCausa
  tribunal: string
  mandante?: string
  clienteId?: number
  demandado?: string
  rutDemandado?: string
  domicilio?: string
  sector?: string
  tipoDiligencia?: string
  origen: OrigenEncargo
  fechaEncargo: string
  fechaDiligencia?: string
  estado: EstadoCausa
  resultado?: ResultadoDiligencia
  observaciones?: string
  estampadoPjud: boolean
  boletaId?: number
}

export type EstadoRetiro = 'Pendiente' | 'En búsqueda' | 'Retirado' | 'No encontrado' | 'Suspendido'

export interface Retiro extends RegistroBase {
  rol: string
  tribunal: string
  mandante?: string
  clienteId?: number
  deudor?: string
  rutDeudor?: string
  patente?: string
  marca?: string
  modelo?: string
  anio?: number
  color?: string
  direccion?: string
  fechaEncargo: string
  fechaVencimiento: string
  estado: EstadoRetiro
  fuerzaPublicaSolicitada?: boolean
  fechaFuerzaSolicitada?: string
  fuerzaPublicaConcedida?: boolean
  fechaFuerzaConcedida?: string
  custodio?: string
  fechaRetiro?: string
  horaRetiro?: string
  observaciones?: string
  /** Valores de los campos personalizados (clave del campo → valor) */
  extras?: Record<string, string | number | boolean | null>
}

export type EstadoBoleta = 'Pendiente' | 'Pagada' | 'Anulada'
export type PagadorRetencion = 'Receptor' | 'Cliente'

export interface Boleta extends RegistroBase {
  numero: number
  fechaEmision: string
  clienteId?: number
  nombreCliente?: string
  rutCliente?: string
  glosa?: string
  bruto: number
  porcentajeRetencion: number
  retencion: number
  liquido: number
  pagaRetencion: PagadorRetencion
  montoCobrar: number
  estado: EstadoBoleta
  nota?: string
  causaIds?: number[]
}

export interface Pago extends RegistroBase {
  boletaId: number
  fecha: string
  monto: number
  medio: string
  nota?: string
}

/** Definición de un campo del formulario de retiros (configurable) */
export type TipoCampo = 'texto' | 'fecha' | 'numero' | 'sino' | 'lista'

export interface CampoRetiro {
  clave: string
  etiqueta: string
  tipo: TipoCampo
  opciones?: string[]
  visible: boolean
  /** true si es un campo de fábrica (no se puede eliminar, solo ocultar o renombrar) */
  base: boolean
  obligatorio?: boolean
}

export interface Ajustes {
  tribunalPorDefecto: string
  /** Límites en días para causas: hasta "reciente" es verde, hasta "media" amarillo, hasta "alta" naranja, sobre eso rojo */
  umbralesCausas: { reciente: number; media: number; alta: number }
  /** Días restantes para retiros: sobre "verde" es verde, desde "amarillo" amarillo, desde 1 naranja, vencido rojo */
  umbralesRetiros: { verde: number; amarillo: number }
  /** Alertas de boletas impagas en días desde la emisión */
  umbralesBoletas: { primera: number; segunda: number; tercera: number }
  porcentajeRetencion: number
  tiposDiligencia: string[]
  mediosPago: string[]
  camposRetiro: CampoRetiro[]
  ultimoRespaldo?: string
  modoOscuro: boolean
  firmaCobro: string
}

export interface FilaAjustes {
  clave: 'general'
  valor: Ajustes
}

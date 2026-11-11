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

/** Tipo de causa: lista editable en Configuración (Civil, Exhorto, Protección, Laboral…) */
export type TipoCausa = string
export const ORIGENES = ['Tribunal', 'Particular', 'Corte de Apelaciones', 'Corte Suprema'] as const
export type OrigenEncargo = (typeof ORIGENES)[number]
export const ESTADOS_CAUSA = ['Pendiente', 'Realizada', 'Suspendida', 'Devuelta'] as const
/** Devuelta = el cliente retiró o cerró el encargo */
export type EstadoCausa = (typeof ESTADOS_CAUSA)[number]
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
  /** Detalle del resultado (Notificado personalmente, art. 44, No se ubicó domicilio…) */
  detalleResultado?: string
  observaciones?: string
  estampadoPjud: boolean
  boletaId?: number
  /** N° de boleta escrito en el Excel importado (para enlazarla en el módulo Boletas) */
  boletaNumero?: number
  /** Encargo marcado como urgente por el cliente */
  urgente?: boolean
  /** El cliente volvió a encargar la misma causa */
  reencargo?: boolean
  /** Fechas de encargo anteriores (reencargos) */
  fechasAnteriores?: string[]
}

export const ESTADOS_RETIRO = ['Pendiente', 'En búsqueda', 'Retirado', 'No encontrado', 'Suspendido'] as const
export type EstadoRetiro = (typeof ESTADOS_RETIRO)[number]

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
  /** Domicilios donde es más probable ubicar el vehículo */
  direccion?: string
  /** Dónde se sacó la revisión técnica */
  revisionTecnica?: string
  /** Dónde se sacó el permiso de circulación */
  permisoCirculacion?: string
  martilleroNombre?: string
  martilleroTelefono?: string
  martilleroDireccion?: string
  /** Fecha de emisión del oficio (obligatoria al ingresar) */
  fechaEmision?: string
  /** Fecha en que llegó el encargo */
  fechaEncargo: string
  /** Fecha de vencimiento del oficio */
  fechaVencimiento: string
  estado: EstadoRetiro
  fuerzaPublicaSolicitada?: boolean
  fechaFuerzaSolicitada?: string
  fuerzaPublicaConcedida?: boolean
  fechaFuerzaConcedida?: string
  custodio?: string
  fechaRetiro?: string
  horaRetiro?: string
  /** Lugar donde se retiró el vehículo */
  lugarRetiro?: string
  observaciones?: string
  /** Familiares o relacionados del demandado (desde los informes de los dealers o a mano) */
  familiares?: Familiar[]
  /** Valores de los campos personalizados (clave del campo → valor) */
  extras?: Record<string, string | number | boolean | null>
}

export interface Familiar {
  nombre: string
  rut?: string
  relacion?: string
}

export type SeccionDomicilio = 'Más probable' | 'Alternativo' | 'Laboral'

/** Domicilio leído de un informe de dealer, con sus notas (0 a 5) */
export interface DomicilioInforme {
  direccion: string
  comuna?: string
  relacion?: string
  seccion: SeccionDomicilio
  contactabilidad?: number
  calidad?: number
  /** Suma de contactabilidad y calidad (0 a 10) */
  puntaje: number
}

export interface InformeLeido {
  titular?: string
  rutTitular?: string
  fechaConsulta?: string
  fuente?: string
  domicilios: DomicilioInforme[]
  relacionados: { rut?: string; nombre: string; relacion: string }[]
  /** true si se pudieron leer las estrellas de calificación */
  conNotas: boolean
}

export const ESTADOS_BOLETA = ['Pendiente', 'Pagada', 'Anulada'] as const
export type EstadoBoleta = (typeof ESTADOS_BOLETA)[number]
/**
 * Quién paga la retención de la boleta:
 * - 'Cliente': el cliente retiene el impuesto (retención del receptor en el SII); se le cobra el líquido.
 * - 'Receptor': la receptora judicial paga la retención (retención del emisor en el SII); se cobra el bruto.
 */
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
  /** Fecha en que se anuló en el SII */
  fechaAnulacion?: string
  nota?: string
  causaIds?: number[]
  /** De dónde salió: a mano, PDF del SII o informe mensual del SII */
  origen?: 'manual' | 'pdf' | 'informe'
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
  /** Campo de fábrica imprescindible: no se puede ocultar (ROL, fechas, estado) */
  fijo?: boolean
}

/** Archivo adjunto (por ahora, informes PDF de los retiros), guardado dentro del equipo */
export interface Archivo {
  id?: number
  retiroId: number
  nombre: string
  tipo: string
  tamano: number
  /** Fecha y hora en que se agregó (ISO) */
  agregado: string
  datos: Blob
  /** Lo que se leyó del informe (se guarda para no volver a leerlo) */
  resumen?: InformeLeido
  ejemplo?: boolean
}

export interface Ajustes {
  tribunalPorDefecto: string
  /** Límites en días para causas: hasta "reciente" es verde, hasta "media" amarillo, hasta "alta" naranja, sobre eso rojo */
  umbralesCausas: { reciente: number; media: number; alta: number }
  /** Días restantes para retiros: sobre "verde" es verde, desde "amarillo" amarillo, desde 1 naranja, vencido rojo */
  umbralesRetiros: { verde: number; amarillo: number }
  /** Días desde el encargo para marcar un retiro con "Prioridad de búsqueda" */
  diasPrioridadBusqueda: number
  /** Días antes del vencimiento del oficio para avisar "Pedir renovación" */
  diasAvisoRenovacion: number
  /** Vigencia habitual del oficio de retiro, en días (para proponer el vencimiento); vacío = no proponer */
  vigenciaOficioDias?: number
  /** Alertas de boletas impagas en días desde la emisión */
  umbralesBoletas: { primera: number; segunda: number; tercera: number }
  porcentajeRetencion: number
  tiposCausa: string[]
  /** Mandantes (bancos, financieras…) para sugerir en causas y retiros */
  mandantes: string[]
  tiposDiligencia: string[]
  detallesResultado: string[]
  sectores: string[]
  mediosPago: string[]
  camposRetiro: CampoRetiro[]
  ultimoRespaldo?: string
  modoOscuro: boolean
  firmaCobro: string
  /** Ruta del día: diligencias elegidas, en el orden en que se visitarán */
  rutaDelDia?: { fecha: string; causaIds: number[] }
  /** Comuna que se agrega a las direcciones sin comuna al abrir Maps o Waze */
  comunaNavegacion: string
  /** Línea bajo el título de la hoja de ruta (nombre, cargo y comuna) */
  encabezadoHojaRuta: string
}

export interface FilaAjustes {
  clave: 'general'
  valor: Ajustes
}

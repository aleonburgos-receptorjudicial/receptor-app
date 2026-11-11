// Respaldo completo de los datos (archivo JSON) y restauración.
// El respaldo incluye clientes, causas, retiros, boletas, pagos, ajustes e informes PDF adjuntos.
import { db } from '../../db/basedatos'
import { guardarAjustes } from '../../db/ajustes'
import type { Archivo, Boleta, Causa, Cliente, FilaAjustes, Pago, Retiro } from '../../db/tipos'
import { diasEntre, fechaCL, hoyISO } from '../../utilidades/formato'

const APP = 'Receptor Judicial'
const VERSION = 1

interface ArchivoRespaldo extends Omit<Archivo, 'datos'> {
  /** Contenido del PDF en base64 */
  datos: string
}

export interface Respaldo {
  app: string
  version: number
  creado: string
  tablas: {
    clientes: Cliente[]
    causas: Causa[]
    retiros: Retiro[]
    boletas: Boleta[]
    pagos: Pago[]
    ajustes: FilaAjustes[]
    archivos: ArchivoRespaldo[]
  }
}

export interface ResumenRespaldo {
  creado: string
  clientes: number
  causas: number
  retiros: number
  boletas: number
  pagos: number
  archivos: number
}

async function aBase64(b: Blob): Promise<string> {
  const bytes = new Uint8Array(await b.arrayBuffer())
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

function deBase64(t: string, tipo: string): Blob {
  const s = atob(t)
  const bytes = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i)
  return new Blob([bytes], { type: tipo || 'application/pdf' })
}

function descargar(contenido: Blob, nombre: string) {
  const url = URL.createObjectURL(contenido)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/** Arma el respaldo completo con todos los datos del equipo */
export async function crearRespaldo(): Promise<Respaldo> {
  const [clientes, causas, retiros, boletas, pagos, ajustes, archivos] = await Promise.all([
    db.clientes.toArray(),
    db.causas.toArray(),
    db.retiros.toArray(),
    db.boletas.toArray(),
    db.pagos.toArray(),
    db.ajustes.toArray(),
    db.archivos.toArray(),
  ])
  return {
    app: APP,
    version: VERSION,
    creado: new Date().toISOString(),
    tablas: {
      clientes,
      causas,
      retiros,
      boletas,
      pagos,
      ajustes,
      archivos: await Promise.all(archivos.map(async (a) => ({ ...a, datos: await aBase64(a.datos) }))),
    },
  }
}

/** Descarga el respaldo completo y anota la fecha del último respaldo */
export async function descargarRespaldo(): Promise<void> {
  const r = await crearRespaldo()
  descargar(new Blob([JSON.stringify(r)], { type: 'application/json' }), `Respaldo Receptor Judicial ${fechaCL(hoyISO())}.json`)
  await guardarAjustes({ ultimoRespaldo: r.creado })
}

/** Lee un archivo de respaldo y revisa que sea de esta app */
export async function leerRespaldo(archivo: File): Promise<{ respaldo: Respaldo; resumen: ResumenRespaldo }> {
  let r: Respaldo
  try {
    r = JSON.parse(await archivo.text())
  } catch {
    throw new Error('El archivo no es un respaldo válido (no se pudo leer).')
  }
  if (r?.app !== APP || typeof r.version !== 'number' || !r.tablas) throw new Error('El archivo no es un respaldo de Receptor Judicial.')
  if (r.version > VERSION) throw new Error('El respaldo es de una versión más nueva de la app. Actualice la app e intente de nuevo.')
  const t = r.tablas
  return {
    respaldo: r,
    resumen: {
      creado: r.creado,
      clientes: t.clientes?.length ?? 0,
      causas: t.causas?.length ?? 0,
      retiros: t.retiros?.length ?? 0,
      boletas: t.boletas?.length ?? 0,
      pagos: t.pagos?.length ?? 0,
      archivos: t.archivos?.length ?? 0,
    },
  }
}

/** Reemplaza TODOS los datos del equipo por los del respaldo */
export async function restaurarRespaldo(r: Respaldo): Promise<void> {
  const t = r.tablas
  await db.transaction('rw', [db.clientes, db.causas, db.retiros, db.boletas, db.pagos, db.ajustes, db.archivos], async () => {
    await Promise.all([db.clientes.clear(), db.causas.clear(), db.retiros.clear(), db.boletas.clear(), db.pagos.clear(), db.ajustes.clear(), db.archivos.clear()])
    await db.clientes.bulkAdd(t.clientes ?? [])
    await db.causas.bulkAdd(t.causas ?? [])
    await db.retiros.bulkAdd(t.retiros ?? [])
    await db.boletas.bulkAdd(t.boletas ?? [])
    await db.pagos.bulkAdd(t.pagos ?? [])
    await db.ajustes.bulkAdd(t.ajustes ?? [])
    await db.archivos.bulkAdd((t.archivos ?? []).map((a) => ({ ...a, datos: deBase64(a.datos, a.tipo) })))
  })
}

/** Días desde el último respaldo (null si nunca se ha respaldado) */
export function diasSinRespaldo(ultimo?: string): number | null {
  if (!ultimo) return null
  return Math.max(0, diasEntre(ultimo.slice(0, 10), hoyISO()))
}

/** Excel con una hoja por módulo, para revisar los datos (no reemplaza al respaldo completo) */
export async function descargarExcelCompleto(): Promise<void> {
  const XLSX = await import('xlsx')
  const [clientes, causas, retiros, boletas, pagos] = await Promise.all([
    db.clientes.toArray(),
    db.causas.toArray(),
    db.retiros.toArray(),
    db.boletas.toArray(),
    db.pagos.toArray(),
  ])
  const nombre = new Map(clientes.map((c) => [c.id, c.nombre]))
  const f = (iso?: string) => (iso ? fechaCL(iso) : '')
  const libro = XLSX.utils.book_new()
  const hoja = (filas: Record<string, unknown>[], titulo: string) => {
    const h = XLSX.utils.json_to_sheet(filas.length ? filas : [{ '(sin datos)': '' }])
    XLSX.utils.book_append_sheet(libro, h, titulo)
  }
  hoja(clientes.map((c) => ({ Nombre: c.nombre, RUT: c.rut ?? '', Contacto: c.contacto ?? '', Correo: c.correo ?? '', Teléfono: c.telefono ?? '', Notas: c.notas ?? '' })), 'Clientes')
  hoja(
    causas.map((c) => ({
      ROL: c.rol, Tipo: c.tipoCausa, Tribunal: c.tribunal, Origen: c.origen, Cliente: c.clienteId ? nombre.get(c.clienteId) ?? '' : '', Mandante: c.mandante ?? '',
      Demandado: c.demandado ?? '', RUT: c.rutDemandado ?? '', Domicilio: c.domicilio ?? '', Sector: c.sector ?? '', Diligencia: c.tipoDiligencia ?? '',
      'Fecha de encargo': f(c.fechaEncargo), 'Fecha de diligencia': f(c.fechaDiligencia), Estado: c.estado, Resultado: c.detalleResultado ?? c.resultado ?? '',
      'Estampado PJUD': c.estampadoPjud ? 'Sí' : 'No', Urgente: c.urgente ? 'Sí' : 'No', Observaciones: c.observaciones ?? '',
    })),
    'Causas',
  )
  hoja(
    retiros.map((r) => ({
      ROL: r.rol, Tribunal: r.tribunal, Cliente: r.clienteId ? nombre.get(r.clienteId) ?? '' : '', Mandante: r.mandante ?? '', Demandado: r.deudor ?? '', RUT: r.rutDeudor ?? '',
      Patente: r.patente ?? '', Vehículo: [r.marca, r.modelo, r.anio, r.color].filter(Boolean).join(' '), 'Fecha de encargo': f(r.fechaEncargo), 'Emisión del oficio': f(r.fechaEmision),
      'Vencimiento del oficio': f(r.fechaVencimiento), Estado: r.estado, Martillero: [r.martilleroNombre, r.martilleroTelefono].filter(Boolean).join(', '),
      'Domicilios probables': r.direccion ?? '', 'Fecha del retiro': f(r.fechaRetiro), 'Lugar del retiro': r.lugarRetiro ?? '', Depósito: r.custodio ?? '',
      Familiares: (r.familiares ?? []).map((x) => `${x.nombre}${x.relacion ? ` (${x.relacion})` : ''}`).join('; '), Observaciones: r.observaciones ?? '',
    })),
    'Retiros',
  )
  hoja(
    boletas.map((b) => ({
      'N°': b.numero, Emisión: f(b.fechaEmision), Cliente: (b.clienteId ? nombre.get(b.clienteId) : undefined) ?? b.nombreCliente ?? '', 'RUT del cliente': b.rutCliente ?? '',
      Glosa: b.glosa ?? '', Bruto: b.bruto, '% retención': b.porcentajeRetencion, Retención: b.retencion, Líquido: b.liquido, 'Monto a cobrar': b.montoCobrar, Estado: b.estado, Nota: b.nota ?? '',
    })),
    'Boletas',
  )
  const numero = new Map(boletas.map((b) => [b.id, b.numero]))
  hoja(pagos.map((p) => ({ 'Boleta N°': numero.get(p.boletaId) ?? '', Fecha: f(p.fecha), Monto: p.monto, Medio: p.medio, Nota: p.nota ?? '' })), 'Pagos')
  XLSX.writeFile(libro, `Datos Receptor Judicial ${fechaCL(hoyISO())}.xlsx`, { compression: true })
}

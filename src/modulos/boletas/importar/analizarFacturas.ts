// Decide qué hacer con cada factura leída de un PDF: agregarla, actualizar la que ya está guardada u omitirla.
import type { Boleta, Cliente, Empresa } from '../../../db/tipos'
import { diasEntre, fechaCL, hoyISO } from '../../../utilidades/formato'
import { limpiarRut } from '../../../utilidades/rut'
import { esFactura } from '../calculos'
import { encontrarCliente, type DatosBoleta } from '../servicioBoletas'
import { buscarEmpresa } from '../servicioEmpresas'
import type { FacturaLeida } from './leerFactura'

export type AccionFactura = 'nueva' | 'actualizar' | 'omitir'

export interface FacturaAnalizada {
  archivo: File
  leida: FacturaLeida
  accion: AccionFactura
  existente?: Boleta
  cliente?: Cliente
  /** La empresa emisora no está en «Mis empresas»: se agregará al guardar */
  empresaNueva: boolean
  avisos: string[]
  motivo?: string
}

export function analizarFacturas(lecturas: { archivo: File; leida: FacturaLeida }[], existentes: Boleta[], clientes: Cliente[], empresas: Empresa[]): FacturaAnalizada[] {
  const hoy = hoyISO()
  const vistas = new Set<string>()
  return lecturas.map(({ archivo, leida }) => {
    const avisos = [...leida.avisos]
    const clave = `${limpiarRut(leida.empresaRut ?? '')}|${leida.numero}`
    const existente = existentes.find((b) => esFactura(b) && b.numero === leida.numero && limpiarRut(b.empresaRut ?? '') === limpiarRut(leida.empresaRut ?? ''))
    const cliente = encontrarCliente(clientes, leida.rutCliente, leida.nombreCliente)
    const empresaNueva = !!leida.empresaRut && !buscarEmpresa(empresas, leida.empresaRut)
    if (leida.fechaEmision && diasEntre(leida.fechaEmision, hoy) > 365) avisos.push(`Factura de hace más de un año (${fechaCL(leida.fechaEmision)}).`)
    if (!cliente && (leida.nombreCliente || leida.rutCliente)) avisos.push('Cliente nuevo.')

    let accion: AccionFactura = existente ? 'omitir' : 'nueva'
    let motivo: string | undefined
    if (!leida.empresaRut) {
      accion = 'omitir'
      motivo = 'Falta el RUT de la empresa emisora: ingrésela a mano.'
    } else if (vistas.has(clave)) {
      accion = 'omitir'
      motivo = 'Repetida: ya está en otro archivo de esta lista.'
    } else if (existente) motivo = 'Ya está guardada. Elija «Actualizar» si quiere reemplazar sus datos y el PDF (se conservan los pagos).'
    vistas.add(clave)
    return { archivo, leida, accion, existente, cliente, empresaNueva, avisos, motivo }
  })
}

/** Datos para guardar una factura leída (si ya existía, se conservan su estado, pagos y nota) */
export function datosDeFactura(f: FacturaAnalizada, clienteId: number | undefined, empresaNombre?: string): DatosBoleta {
  const l = f.leida
  const base: DatosBoleta = f.existente
    ? (({ id: _i, creado: _c, actualizado: _a, ejemplo: _e, ...resto }) => resto)(f.existente)
    : { numero: l.numero, fechaEmision: hoyISO(), bruto: 0, porcentajeRetencion: 0, retencion: 0, liquido: 0, pagaRetencion: 'Cliente', montoCobrar: 0, estado: 'Pendiente', causaIds: [] }
  return {
    ...base,
    tipoDocumento: 'factura',
    numero: l.numero,
    fechaEmision: l.fechaEmision ?? base.fechaEmision,
    empresaRut: l.empresaRut,
    empresaNombre: empresaNombre ?? l.empresaNombre,
    clienteId: clienteId ?? base.clienteId,
    nombreCliente: l.nombreCliente ?? base.nombreCliente,
    rutCliente: l.rutCliente ?? base.rutCliente,
    glosa: l.glosa ?? base.glosa,
    neto: l.neto,
    exento: l.exento,
    iva: l.iva,
    origen: 'pdf',
  }
}

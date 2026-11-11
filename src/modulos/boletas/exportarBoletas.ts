// Exporta las boletas a Excel con cuatro hojas: Boletas, Impagas, Por cliente y Anuladas.
import * as XLSX from 'xlsx'
import type { Boleta, Cliente, Pago } from '../../db/tipos'
import { fechaCL, hoyISO } from '../../utilidades/formato'
import { cobradoBoleta, diasDesdeEmision, porCliente, saldoBoleta, vigente } from './calculos'

const fecha = (iso?: string) => {
  if (!iso) return null
  const [a, m, d] = iso.split('-').map(Number)
  return new Date(a, m - 1, d)
}

function hoja(encabezados: string[], filas: (string | number | Date | null)[][]) {
  const h = XLSX.utils.aoa_to_sheet([encabezados, ...filas], { cellDates: true, dateNF: 'dd-mm-yyyy' })
  h['!cols'] = encabezados.map((e) => ({ wch: /glosa|cliente|nota/i.test(e) ? 36 : Math.max(12, e.length + 2) }))
  h['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: filas.length, c: encabezados.length - 1 } }) }
  return h
}

export function exportarBoletas(boletas: Boleta[], pagos: Pago[], clientes: Cliente[]): void {
  const hoy = hoyISO()
  const nombre = new Map(clientes.map((c) => [c.id, c.nombre]))
  const cliente = (b: Boleta) => (b.clienteId ? nombre.get(b.clienteId) : undefined) ?? b.nombreCliente ?? ''
  const ultimoPago = (b: Boleta) => pagos.filter((p) => p.boletaId === b.id).map((p) => p.fecha).sort().pop()
  const ordenadas = [...boletas].sort((a, b) => a.numero - b.numero)

  const encBoleta = ['N°', 'Fecha de emisión', 'Cliente', 'RUT del cliente', 'Glosa', 'Bruto', '% retención', 'Retención', 'Líquido', 'Paga la retención', 'Monto a cobrar', 'Cobrado', 'Por cobrar', 'Estado', 'Último pago', 'Nota']
  const filaBoleta = (b: Boleta) => [
    b.numero,
    fecha(b.fechaEmision),
    cliente(b),
    b.rutCliente ?? '',
    b.glosa ?? '',
    b.bruto,
    b.porcentajeRetencion,
    b.retencion,
    b.liquido,
    b.pagaRetencion === 'Cliente' ? 'Cliente' : 'Receptora',
    b.montoCobrar,
    cobradoBoleta(b, pagos),
    saldoBoleta(b, pagos),
    b.estado,
    fecha(ultimoPago(b)),
    b.nota ?? '',
  ]

  const libro = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(libro, hoja(encBoleta, ordenadas.filter(vigente).map(filaBoleta)), 'Boletas')
  XLSX.utils.book_append_sheet(
    libro,
    hoja(
      ['N°', 'Fecha de emisión', 'Días desde la emisión', 'Cliente', 'RUT del cliente', 'Glosa', 'Monto a cobrar', 'Por cobrar'],
      ordenadas
        .filter((b) => saldoBoleta(b, pagos) > 0)
        .sort((a, b) => a.fechaEmision.localeCompare(b.fechaEmision))
        .map((b) => [b.numero, fecha(b.fechaEmision), diasDesdeEmision(b, hoy), cliente(b), b.rutCliente ?? '', b.glosa ?? '', b.montoCobrar, saldoBoleta(b, pagos)]),
    ),
    'Impagas',
  )
  XLSX.utils.book_append_sheet(
    libro,
    hoja(
      ['Cliente', 'RUT', 'Cobrado', 'Por cobrar', 'Boletas impagas', 'Días de la impaga más antigua', 'Tiempo promedio de pago (días)'],
      porCliente(boletas, pagos, clientes, hoy).map((c) => [c.nombre, c.rut ?? '', c.pagado, c.adeudado, c.impagas, c.impagas ? c.masAntigua : null, c.promedioPago]),
    ),
    'Por cliente',
  )
  XLSX.utils.book_append_sheet(
    libro,
    hoja(
      ['N°', 'Fecha de emisión', 'Fecha de anulación', 'Cliente', 'RUT del cliente', 'Glosa', 'Bruto'],
      ordenadas.filter((b) => !vigente(b)).map((b) => [b.numero, fecha(b.fechaEmision), fecha(b.fechaAnulacion), cliente(b), b.rutCliente ?? '', b.glosa ?? '', b.bruto]),
    ),
    'Anuladas',
  )
  XLSX.writeFile(libro, `Boletas de honorarios ${fechaCL(hoy)}.xlsx`, { compression: true })
}

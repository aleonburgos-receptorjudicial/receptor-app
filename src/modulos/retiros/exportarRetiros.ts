// Exporta los retiros de vehículos a Excel, con los campos en el orden y con los nombres configurados.
import * as XLSX from 'xlsx'
import type { CampoRetiro, Cliente, Retiro } from '../../db/tipos'
import { fechaCL, hoyISO } from '../../utilidades/formato'
import { valorCampo } from './servicioRetiros'
import { diasRestantes, retiroActivo } from './vencimiento'

const fechaExcel = (iso: string) => {
  const [a, m, d] = iso.split('-').map(Number)
  return new Date(a, m - 1, d)
}

export function exportarRetiros(retiros: Retiro[], clientes: Cliente[], campos: CampoRetiro[], nombreArchivo?: string): void {
  const hoy = hoyISO()
  const nombreCliente = new Map(clientes.map((c) => [c.id, c.nombre]))
  const visibles = campos.filter((c) => c.visible)
  const encabezados = [...visibles.map((c) => c.etiqueta), 'Días restantes']

  const filas = retiros.map((r) => [
    ...visibles.map((c) => {
      const v = valorCampo(r, c)
      if (c.clave === 'clienteId') return typeof v === 'number' ? nombreCliente.get(v) ?? '' : ''
      if (v === undefined || v === null || v === '') return null
      if (c.tipo === 'sino') return v === true ? 'Sí' : 'No'
      if (c.tipo === 'fecha' && typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return fechaExcel(v)
      return v
    }),
    retiroActivo(r) ? diasRestantes(r, hoy) : null,
  ])

  const hoja = XLSX.utils.aoa_to_sheet([encabezados, ...filas], { cellDates: true, dateNF: 'dd-mm-yyyy' })
  hoja['!cols'] = encabezados.map((h) => ({ wch: /observ|direcci|deudor|tribunal|estudio/i.test(h) ? 30 : Math.max(12, h.length + 2) }))
  hoja['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: filas.length, c: encabezados.length - 1 } }) }
  const libro = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(libro, hoja, 'Retiros')
  XLSX.writeFile(libro, nombreArchivo ?? `Retiros de vehículos ${fechaCL(hoy)}.xlsx`, { compression: true })
}

// Exporta causas a Excel con los mismos encabezados de la planilla "Control de Encargos",
// para que el archivo se pueda volver a importar.
import * as XLSX from 'xlsx'
import type { Ajustes, Causa, Cliente } from '../../db/tipos'
import { hoyISO, fechaCL } from '../../utilidades/formato'
import { diasDesdeEncargo } from './prioridad'

/** "AAAA-MM-DD" → fecha de Excel */
const fechaExcel = (iso?: string) => {
  if (!iso) return null
  const [a, m, d] = iso.split('-').map(Number)
  return new Date(a, m - 1, d)
}

export function exportarCausas(causas: Causa[], clientes: Cliente[], ajustes: Ajustes, nombreArchivo?: string): void {
  const nombreCliente = new Map(clientes.map((c) => [c.id, c.nombre]))
  const encabezados = [
    'Fecha solicitud',
    'Causa ROL',
    'Tipo',
    'Tribunal',
    'Origen',
    'Cliente / estudio',
    'Mandante',
    'Demandado / a notificar',
    'RUT',
    'Diligencia',
    'Dirección',
    'Sector',
    'Prioridad',
    'Estado',
    'Días pendiente',
    'Fecha actuación',
    'Resultado',
    'Positiva / negativa',
    'Estampado subido PJUD',
    'Reencargo',
    'Observaciones',
  ]
  const hoy = hoyISO()
  const filas = causas.map((c) => [
    fechaExcel(c.fechaEncargo),
    c.rol,
    c.tipoCausa,
    c.tribunal,
    c.origen,
    c.clienteId ? nombreCliente.get(c.clienteId) ?? '' : '',
    c.mandante ?? '',
    c.demandado ?? '',
    c.rutDemandado ?? '',
    c.tipoDiligencia ?? '',
    c.domicilio ?? '',
    c.sector ?? '',
    c.urgente ? 'Urgente' : 'Normal',
    c.estado,
    c.estado === 'Pendiente' ? diasDesdeEncargo(c, hoy) : null,
    fechaExcel(c.fechaDiligencia),
    c.detalleResultado ?? c.resultado ?? '',
    c.resultado ?? '',
    c.estampadoPjud ? 'Sí' : 'No',
    c.reencargo ? 'Sí' : 'No',
    c.observaciones ?? '',
  ])
  const hoja = XLSX.utils.aoa_to_sheet([encabezados, ...filas], { cellDates: true, dateNF: 'dd-mm-yyyy' })
  hoja['!cols'] = encabezados.map((h) => ({ wch: h === 'Observaciones' ? 50 : h.includes('Demandado') || h.includes('Cliente') || h === 'Tribunal' || h === 'Dirección' ? 30 : Math.max(12, h.length + 2) }))
  hoja['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: filas.length, c: encabezados.length - 1 } }) }

  const libro = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(libro, hoja, 'Encargos')
  // Hoja "Listas" para que el archivo sirva también de respaldo de las listas
  const listas = [
    ['Diligencia', 'Resultado', 'Sector', 'Tipo de causa'],
    ...Array.from({ length: Math.max(ajustes.tiposDiligencia.length, ajustes.detallesResultado.length, ajustes.sectores.length, ajustes.tiposCausa.length) }, (_, i) => [
      ajustes.tiposDiligencia[i] ?? null,
      ajustes.detallesResultado[i] ?? null,
      ajustes.sectores[i] ?? null,
      ajustes.tiposCausa[i] ?? null,
    ]),
  ]
  XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet(listas), 'Listas')
  XLSX.writeFile(libro, nombreArchivo ?? `Causas ${fechaCL(hoy)}.xlsx`, { compression: true })
}

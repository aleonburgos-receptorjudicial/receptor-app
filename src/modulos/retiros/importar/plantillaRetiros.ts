// Planilla modelo para importar retiros: una hoja vacía con los encabezados que la app reconoce,
// más una hoja de ejemplo (ficticio) y otra con instrucciones. Las hojas que empiezan con "_" no se importan.
import * as XLSX from 'xlsx'
import type { CampoRetiro } from '../../../db/tipos'

// Datos del momento del retiro: se registran después en la app, no al cargar el encargo
const SOLO_AL_RETIRAR = new Set(['fechaRetiro', 'horaRetiro', 'lugarRetiro', 'custodio', 'fuerzaPublicaSolicitada', 'fuerzaPublicaConcedida'])

const EJEMPLO: Record<string, string | number> = {
  rol: 'C-1234-2026',
  tribunal: '2° Juzgado Civil de Concepción',
  fechaEmision: '02-11-2026',
  fechaVencimiento: '02-01-2027',
  fechaEncargo: '05-11-2026',
  estado: 'Pendiente',
  patente: 'BBBB12',
  marca: 'Marca de ejemplo',
  modelo: 'Modelo de ejemplo',
  color: 'Gris',
  anio: 2019,
  deudor: 'Persona Ficticia',
  rutDeudor: '11.111.111-1',
  mandante: 'Banco de Ejemplo',
  clienteId: 'Estudio de Ejemplo',
  martilleroNombre: 'Martillero Ficticio',
  martilleroTelefono: '+56 9 1234 5678',
  martilleroDireccion: 'Calle Ficticia 100, Concepción',
  revisionTecnica: 'Curanilahue',
  permisoCirculacion: 'Curanilahue',
  direccion: 'Pasaje Ejemplo 12, Curanilahue',
  observaciones: 'Fila de ejemplo: no se importa.',
}

export function descargarPlantillaRetiros(campos: CampoRetiro[]): void {
  const columnas = campos.filter((c) => c.visible && !SOLO_AL_RETIRAR.has(c.clave))
  const encabezados = columnas.map((c) => c.etiqueta)
  const ancho = encabezados.map((h) => ({ wch: Math.max(14, Math.min(34, h.length + 4)) }))

  const hoja = XLSX.utils.aoa_to_sheet([encabezados])
  hoja['!cols'] = ancho
  const ejemplo = XLSX.utils.aoa_to_sheet([encabezados, columnas.map((c) => EJEMPLO[c.clave] ?? '')])
  ejemplo['!cols'] = ancho
  const instrucciones = XLSX.utils.aoa_to_sheet(
    [
      ['Cómo llenar la planilla de retiros'],
      [''],
      ['1. Escriba un retiro por fila en la hoja «Retiros», debajo de los encabezados. No cambie los encabezados.'],
      ['2. Obligatorios: Causa ROL y la fecha de vencimiento del oficio. Si en Configuración tiene una vigencia habitual, basta con la fecha de emisión.'],
      ['3. Fechas como 05-11-2026. Si falta la fecha del encargo, al importar puede elegir una para todo el lote.'],
      ['4. Estudio jurídico: escriba el nombre. Si no existe en la app, se crea solo.'],
      ['5. Si un retiro ya está en la app (mismo ROL y patente), se actualiza con los datos de la planilla; las celdas vacías no borran nada.'],
      ['6. Puede dejar columnas vacías o borrarlas. La hoja «_Ejemplo» muestra una fila llenada (datos ficticios).'],
    ],
  )
  instrucciones['!cols'] = [{ wch: 120 }]

  const libro = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(libro, hoja, 'Retiros')
  XLSX.utils.book_append_sheet(libro, ejemplo, '_Ejemplo')
  XLSX.utils.book_append_sheet(libro, instrucciones, '_Instrucciones')
  XLSX.writeFile(libro, 'Planilla para importar retiros.xlsx', { compression: true })
}

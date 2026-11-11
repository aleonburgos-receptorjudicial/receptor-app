// Informes PDF adjuntos a los retiros: se guardan dentro del equipo (no se suben a internet).
import { ahoraISO, db } from '../../db/basedatos'
import type { Archivo } from '../../db/tipos'

/** Tamaño máximo por archivo (25 MB) para no llenar la memoria del celular */
export const TAMANO_MAXIMO = 25 * 1024 * 1024

export function esPdf(f: File): boolean {
  return f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
}

/** Revisa los archivos elegidos: devuelve los válidos y un mensaje por cada rechazado */
export function revisarArchivos(archivos: File[]): { validos: File[]; errores: string[] } {
  const validos: File[] = []
  const errores: string[] = []
  for (const f of archivos) {
    if (!esPdf(f)) errores.push(`«${f.name}» no es un PDF.`)
    else if (f.size > TAMANO_MAXIMO) errores.push(`«${f.name}» pesa más de 25 MB.`)
    else validos.push(f)
  }
  return { validos, errores }
}

export async function agregarArchivos(retiroId: number, archivos: File[]): Promise<void> {
  const agregado = ahoraISO()
  await db.archivos.bulkAdd(
    archivos.map((f) => ({ retiroId, nombre: f.name, tipo: f.type || 'application/pdf', tamano: f.size, agregado, datos: f })),
  )
}

export async function eliminarArchivo(id: number): Promise<void> {
  await db.archivos.delete(id)
}

/** Abre el PDF en una pestaña nueva (en el celular, con el visor de PDF del teléfono) */
export function abrirArchivo(a: Pick<Archivo, 'datos' | 'nombre' | 'tipo'>): void {
  const blob = a.datos.type ? a.datos : new Blob([a.datos], { type: a.tipo || 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const ventana = window.open(url, '_blank')
  if (!ventana) {
    // Si el navegador bloquea la ventana nueva, se abre con un enlace
    const enlace = document.createElement('a')
    enlace.href = url
    enlace.target = '_blank'
    enlace.rel = 'noopener'
    enlace.click()
  }
  setTimeout(() => URL.revokeObjectURL(url), 5 * 60_000)
}

/** Tamaño legible: "1,2 MB", "340 KB" */
export function tamanoLegible(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toLocaleString('es-CL', { maximumFractionDigits: 1 })} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

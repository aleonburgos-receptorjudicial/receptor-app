// Sección "Informes PDF" dentro del formulario de un retiro: agregar, abrir y quitar informes de los dealers.
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/basedatos'
import type { Archivo } from '../../db/tipos'
import { Boton } from '../../compartido/Controles'
import { useAviso, useConfirmar } from '../../compartido/Dialogos'
import { fechaCL } from '../../utilidades/formato'
import { abrirArchivo, agregarArchivos, eliminarArchivo, revisarArchivos, tamanoLegible } from './servicioArchivos'

/**
 * Si el retiro ya existe (retiroId), los archivos se guardan al tiro.
 * Si es un retiro nuevo, quedan "pendientes" y se guardan junto con el retiro.
 */
export interface PdfParaLeer {
  datos: Blob
  nombre: string
  archivoId?: number
  resumen?: Archivo['resumen']
}

export function AdjuntosRetiro({
  retiroId,
  pendientes,
  alCambiarPendientes,
  alLeer,
}: {
  retiroId?: number
  pendientes: File[]
  alCambiarPendientes: (f: File[]) => void
  /** Abre el resumen del informe (domicilios y familiares) */
  alLeer: (pdf: PdfParaLeer) => void
}) {
  const avisar = useAviso()
  const confirmar = useConfirmar()
  const [errores, setErrores] = useState<string[]>([])
  const guardados = useLiveQuery(() => (retiroId ? db.archivos.where('retiroId').equals(retiroId).toArray() : []), [retiroId]) ?? []

  const elegir = async (lista: FileList | null) => {
    if (!lista?.length) return
    const { validos, errores: er } = revisarArchivos([...lista])
    setErrores(er)
    if (!validos.length) return
    if (retiroId) {
      await agregarArchivos(retiroId, validos)
      avisar(validos.length === 1 ? 'Informe PDF guardado' : `${validos.length} informes PDF guardados`)
    } else {
      alCambiarPendientes([...pendientes, ...validos])
    }
  }

  const quitarGuardado = async (id: number, nombre: string) => {
    const ok = await confirmar({ titulo: 'Quitar informe', mensaje: `¿Quitar el informe «${nombre}» de este retiro?`, textoConfirmar: 'Quitar', peligro: true })
    if (!ok) return
    await eliminarArchivo(id)
    avisar('Informe quitado')
  }

  const hay = guardados.length + pendientes.length > 0

  return (
    <section className="flex flex-col gap-3 rounded-xl border-2 border-dashed border-borde p-4" aria-labelledby="titulo-adjuntos">
      <h3 id="titulo-adjuntos" className="font-serif text-lg font-bold">
        Informes PDF del dealer
      </h3>
      <p className="text-sm text-tenue">Quedan guardados en este equipo, junto al retiro, y se abren también sin internet. «Leer informe» ordena los domicilios por contactabilidad y calidad, y saca los familiares.</p>
      {hay && (
        <ul className="flex flex-col gap-2">
          {guardados.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-papel px-3 py-2">
              <span className="min-w-0 flex-1 break-all">
                <span className="font-bold">{a.nombre}</span>
                <span className="block text-sm text-tenue">
                  {tamanoLegible(a.tamano)}, agregado el {fechaCL(a.agregado)}
                </span>
              </span>
              <Boton className="min-h-10 py-1" onClick={() => alLeer({ datos: a.datos, nombre: a.nombre, archivoId: a.id, resumen: a.resumen })}>
                {a.resumen ? 'Ver resumen' : 'Leer informe'}
              </Boton>
              <Boton variante="secundario" className="min-h-10 py-1" onClick={() => abrirArchivo(a)}>
                Abrir PDF
              </Boton>
              <Boton variante="discreto" className="min-h-10 py-1 text-rojo" aria-label={`Quitar ${a.nombre}`} onClick={() => quitarGuardado(a.id!, a.nombre)}>
                Quitar
              </Boton>
            </li>
          ))}
          {pendientes.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex flex-wrap items-center gap-2 rounded-lg bg-papel px-3 py-2">
              <span className="min-w-0 flex-1 break-all">
                <span className="font-bold">{f.name}</span>
                <span className="block text-sm text-tenue">{tamanoLegible(f.size)}, se guardará junto con el retiro</span>
              </span>
              <Boton className="min-h-10 py-1" onClick={() => alLeer({ datos: f, nombre: f.name })}>
                Leer informe
              </Boton>
              <Boton variante="discreto" className="min-h-10 py-1 text-rojo" aria-label={`Quitar ${f.name}`} onClick={() => alCambiarPendientes(pendientes.filter((_, j) => j !== i))}>
                Quitar
              </Boton>
            </li>
          ))}
        </ul>
      )}
      <label className="flex min-h-12 cursor-pointer items-center justify-center rounded-lg border-2 border-petroleo bg-superficie px-4 py-2 font-bold text-petroleo hover:bg-petroleo-suave">
        Agregar informe PDF
        <input type="file" accept="application/pdf,.pdf" multiple className="sr-only" onChange={(e) => {
          elegir(e.target.files)
          e.target.value = ''
        }} />
      </label>
      {errores.map((e) => (
        <p key={e} className="text-sm font-bold text-rojo" role="alert">
          {e}
        </p>
      ))}
    </section>
  )
}

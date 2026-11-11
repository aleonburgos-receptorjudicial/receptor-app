// Respaldos: descargar el respaldo completo, un Excel con todo, y restaurar desde un respaldo.
import { useState } from 'react'
import { useAjustes } from '../../db/ajustes'
import { Boton, Seccion } from '../../compartido/Controles'
import { useAviso, useConfirmar } from '../../compartido/Dialogos'
import { fechaCL, plural } from '../../utilidades/formato'
import { descargarExcelCompleto, descargarRespaldo, diasSinRespaldo, leerRespaldo, restaurarRespaldo } from './respaldo'

/** Aviso para recordar el respaldo (se usa también en Inicio) */
export function textoRespaldo(ultimo?: string): { texto: string; atrasado: boolean } {
  const dias = diasSinRespaldo(ultimo)
  if (dias === null) return { texto: 'Aún no ha hecho ningún respaldo de sus datos.', atrasado: true }
  if (dias === 0) return { texto: 'Último respaldo: hoy.', atrasado: false }
  return { texto: `Último respaldo: hace ${plural(dias, 'día', 'días')} (${fechaCL(ultimo)}).`, atrasado: dias > 7 }
}

export function SeccionRespaldos() {
  const ajustes = useAjustes()
  const avisar = useAviso()
  const confirmar = useConfirmar()
  const [trabajando, setTrabajando] = useState(false)
  const estado = textoRespaldo(ajustes.ultimoRespaldo)

  const respaldar = async () => {
    setTrabajando(true)
    try {
      await descargarRespaldo()
      avisar('Respaldo descargado. Guárdelo en un lugar seguro (pendrive, correo o Google Drive).')
    } catch {
      avisar('No se pudo crear el respaldo. Intente de nuevo.', 'error')
    } finally {
      setTrabajando(false)
    }
  }

  const excel = async () => {
    try {
      await descargarExcelCompleto()
      avisar('Excel con todos sus datos descargado')
    } catch {
      avisar('No se pudo crear el Excel.', 'error')
    }
  }

  const restaurar = async (archivo?: File) => {
    if (!archivo) return
    try {
      const { respaldo, resumen } = await leerRespaldo(archivo)
      const ok = await confirmar({
        titulo: 'Restaurar respaldo',
        peligro: true,
        textoConfirmar: 'Reemplazar mis datos',
        mensaje: (
          <>
            <p>
              Respaldo del <strong>{fechaCL(resumen.creado)}</strong> con {plural(resumen.causas, 'causa', 'causas')}, {plural(resumen.retiros, 'retiro', 'retiros')},{' '}
              {plural(resumen.boletas, 'boleta', 'boletas')}, {plural(resumen.clientes, 'cliente', 'clientes')} y {plural(resumen.archivos, 'informe PDF', 'informes PDF')}.
            </p>
            <p className="mt-3 font-bold">Esto reemplaza TODOS los datos que hay ahora en este equipo.</p>
            <p className="mt-2 text-tenue">Si no está segura, cancele y descargue primero un respaldo de lo que tiene ahora.</p>
          </>
        ),
      })
      if (!ok) return
      setTrabajando(true)
      await restaurarRespaldo(respaldo)
      avisar('Respaldo restaurado')
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'No se pudo restaurar el respaldo.', 'error')
    } finally {
      setTrabajando(false)
    }
  }

  return (
    <Seccion titulo="Respaldos">
      <p className={`mb-4 rounded-lg border-l-4 p-3 font-bold ${estado.atrasado ? 'border-naranja bg-naranja-suave' : 'border-verde bg-verde-suave'}`} role="status">
        {estado.texto}
        {estado.atrasado && <span className="block font-normal">Recomendación: respalde al menos una vez por semana.</span>}
      </p>
      <p className="mb-4 max-w-[70ch] text-tenue">
        Sus datos se guardan solo en este equipo. Si el celular se pierde o se borra el navegador, se pierden. El respaldo es un archivo con todo (incluidos los
        informes PDF) que puede guardar en un pendrive, en su correo o en Google Drive, y restaurar aquí o en otro equipo.
      </p>
      <div className="flex flex-wrap gap-2">
        <Boton onClick={respaldar} disabled={trabajando}>
          Descargar respaldo completo
        </Boton>
        <Boton variante="secundario" onClick={excel}>
          Descargar Excel con todo
        </Boton>
        <label className={`inline-flex min-h-12 cursor-pointer items-center justify-center rounded-lg border-2 border-petroleo bg-superficie px-4 py-2 font-bold text-petroleo hover:bg-petroleo-suave ${trabajando ? 'pointer-events-none opacity-50' : ''}`}>
          Restaurar un respaldo
          <input
            type="file"
            accept=".json,application/json"
            className="sr-only"
            onChange={(e) => {
              restaurar(e.target.files?.[0])
              e.target.value = ''
            }}
          />
        </label>
      </div>
      <p className="mt-3 text-sm text-tenue">El Excel sirve para revisar o imprimir sus datos. Para recuperar todo, use el respaldo completo.</p>
    </Seccion>
  )
}

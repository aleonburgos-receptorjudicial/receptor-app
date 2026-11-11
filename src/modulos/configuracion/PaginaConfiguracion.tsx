// Configuración. En la fase 1: apariencia y datos de ejemplo.
// Umbrales, listas, campos de retiros y respaldos se agregan en las fases siguientes.
import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { guardarAjustes, useAjustes } from '../../db/ajustes'
import { borrarDatosEjemplo, cargarDatosEjemplo, hayDatosEjemplo } from '../../db/ejemplo'
import { Boton, EncabezadoPagina, Seccion } from '../../compartido/Controles'
import { useAviso, useConfirmar } from '../../compartido/Dialogos'
import { IconoLuna } from '../../compartido/Iconos'

export function PaginaConfiguracion() {
  const ajustes = useAjustes()
  const confirmar = useConfirmar()
  const avisar = useAviso()
  const conEjemplo = useLiveQuery(hayDatosEjemplo, [])
  // Estado inmediato del interruptor (se guarda en la base y se sincroniza)
  const [oscuro, setOscuro] = useState(ajustes.modoOscuro)
  useEffect(() => setOscuro(ajustes.modoOscuro), [ajustes.modoOscuro])

  const cambiarModo = (valor: boolean) => {
    setOscuro(valor)
    document.documentElement.classList.toggle('oscuro', valor)
    guardarAjustes({ modoOscuro: valor })
  }

  const cargar = async () => {
    await cargarDatosEjemplo()
    avisar('Datos de ejemplo cargados. Revise el módulo Clientes.')
  }

  const borrar = async () => {
    const ok = await confirmar({
      titulo: 'Borrar datos de ejemplo',
      mensaje: 'Se borrarán solo los clientes, causas y boletas de ejemplo. Sus datos reales no se tocan.',
      textoConfirmar: 'Borrar ejemplos',
      peligro: true,
    })
    if (!ok) return
    await borrarDatosEjemplo()
    avisar('Datos de ejemplo borrados')
  }

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoPagina titulo="Configuración y respaldos" descripcion="Ajuste la app a su forma de trabajar." />

      <Seccion titulo="Apariencia">
        <label className="flex min-h-12 cursor-pointer items-center justify-between gap-4">
          <span className="flex items-center gap-3 text-lg">
            <IconoLuna />
            <span>
              Modo oscuro
              <span className="block text-base text-tenue">Fondo oscuro, más cómodo de noche.</span>
            </span>
          </span>
          <input
            type="checkbox"
            role="switch"
            className="h-7 w-7 accent-[var(--petroleo)]"
            checked={oscuro}
            onChange={(e) => cambiarModo(e.target.checked)}
          />
        </label>
      </Seccion>

      <Seccion titulo="Datos de ejemplo">
        <p className="max-w-[65ch] text-tenue">
          Cargue clientes, causas y boletas inventados para probar la app. Cuando termine, bórrelos con un botón: sus datos reales no se tocan.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Boton variante="secundario" onClick={cargar} disabled={conEjemplo === true}>
            Cargar datos de ejemplo
          </Boton>
          <Boton variante="peligro" onClick={borrar} disabled={!conEjemplo}>
            Borrar datos de ejemplo
          </Boton>
        </div>
        {conEjemplo && <p className="mt-3 font-bold text-petroleo">Hay datos de ejemplo cargados.</p>}
      </Seccion>

      <Seccion titulo="Próximamente">
        <p className="text-tenue">
          En las próximas fases se agregan aquí: los plazos y colores de alerta, las listas de tipos de diligencia y medios de pago, los campos del
          formulario de retiros, y el respaldo completo de sus datos.
        </p>
      </Seccion>
    </div>
  )
}

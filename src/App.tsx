// Rutas de la aplicación. Se usa HashRouter para que funcione en cualquier carpeta y sin servidor especial.
import { useEffect } from 'react'
import { HashRouter, MemoryRouter, Route, Routes } from 'react-router-dom'
import { useAjustes } from './db/ajustes'
import { ProveedorDialogos } from './compartido/Dialogos'
import { Estructura, NoEncontrada } from './compartido/Estructura'
import { PaginaInicio } from './modulos/inicio/PaginaInicio'
import { PaginaBoletas } from './modulos/boletas/PaginaBoletas'
import { PaginaCausas } from './modulos/causas/PaginaCausas'
import { PaginaRuta } from './modulos/causas/ruta/PaginaRuta'
import { PaginaClientes } from './modulos/clientes/PaginaClientes'
import { FichaCliente } from './modulos/clientes/FichaCliente'
import { PaginaConfiguracion } from './modulos/configuracion/PaginaConfiguracion'
import { PaginaRetiros } from './modulos/retiros/PaginaRetiros'

// En la versión de vista previa (página de Claude) se navega sin cambiar la dirección web.
const Enrutador = import.meta.env.VITE_ENRUTADOR === 'memoria' ? MemoryRouter : HashRouter

export default function App() {
  const ajustes = useAjustes()

  // Aplica el modo oscuro según la configuración
  useEffect(() => {
    document.documentElement.classList.toggle('oscuro', ajustes.modoOscuro)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', ajustes.modoOscuro ? '#1A2629' : '#0E4D57')
  }, [ajustes.modoOscuro])

  return (
    <ProveedorDialogos>
      <Enrutador>
        <Routes>
          <Route element={<Estructura />}>
            <Route index element={<PaginaInicio />} />
            <Route path="causas" element={<PaginaCausas />} />
            <Route path="ruta" element={<PaginaRuta />} />
            <Route path="retiros" element={<PaginaRetiros />} />
            <Route path="boletas" element={<PaginaBoletas />} />
            <Route path="clientes" element={<PaginaClientes />} />
            <Route path="clientes/:id" element={<FichaCliente />} />
            <Route path="configuracion" element={<PaginaConfiguracion />} />
            <Route path="*" element={<NoEncontrada />} />
          </Route>
        </Routes>
      </Enrutador>
    </ProveedorDialogos>
  )
}

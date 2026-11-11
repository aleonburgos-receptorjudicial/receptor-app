// Rutas de la aplicación. Se usa HashRouter para que funcione en cualquier carpeta y sin servidor especial.
import { useEffect } from 'react'
import { HashRouter, MemoryRouter, Route, Routes } from 'react-router-dom'
import { useAjustes } from './db/ajustes'
import { ProveedorDialogos } from './compartido/Dialogos'
import { EnConstruccion, Estructura } from './compartido/Estructura'
import { PaginaClientes } from './modulos/clientes/PaginaClientes'
import { FichaCliente } from './modulos/clientes/FichaCliente'
import { PaginaConfiguracion } from './modulos/configuracion/PaginaConfiguracion'

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
            <Route index element={<EnConstruccion titulo="Inicio" fase={5} />} />
            <Route path="causas" element={<EnConstruccion titulo="Causas" fase={2} />} />
            <Route path="retiros" element={<EnConstruccion titulo="Retiros de vehículos" fase={3} />} />
            <Route path="boletas" element={<EnConstruccion titulo="Boletas de honorarios" fase={4} />} />
            <Route path="clientes" element={<PaginaClientes />} />
            <Route path="clientes/:id" element={<FichaCliente />} />
            <Route path="configuracion" element={<PaginaConfiguracion />} />
            <Route path="*" element={<EnConstruccion titulo="Página no encontrada" fase={1} />} />
          </Route>
        </Routes>
      </Enrutador>
    </ProveedorDialogos>
  )
}

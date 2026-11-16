import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { protegerDatos } from './modulos/configuracion/SeccionInstalar'
import { iniciarActualizaciones } from './pwa/actualizar'

// Se pide al navegador que no borre los datos de la app
protegerDatos()
// La app se actualiza sola al abrirla cuando hay una versión nueva
iniciarActualizaciones()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

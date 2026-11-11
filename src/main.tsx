import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { protegerDatos } from './modulos/configuracion/SeccionInstalar'

// Se pide al navegador que no borre los datos de la app
protegerDatos()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

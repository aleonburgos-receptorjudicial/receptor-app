/// <reference types="vite-plugin-pwa/client" />
// Registro de la app instalable. Al abrirla, si hay una versión nueva publicada, se descarga y la página
// se recarga sola una vez (solo al iniciar, para no interrumpir mientras se llena un formulario).
import { registerSW } from 'virtual:pwa-register'

export function iniciarActualizaciones() {
  if (!('serviceWorker' in navigator)) return
  registerSW({ immediate: true })
}

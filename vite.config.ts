import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// La vista previa en claude.ai no admite instalación (service worker): ahí se compila sin PWA.
const vistaPrevia = process.env.VITE_ENRUTADOR === 'memoria'

// Configuración de Vite. "base: './'" permite publicar la app en cualquier carpeta (por ejemplo, GitHub Pages).
export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    !vistaPrevia &&
      VitePWA({
        // La app se actualiza sola cuando hay una versión nueva
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
        manifest: {
          name: 'Receptor Judicial',
          short_name: 'Receptor',
          description: 'Causas, retiros de vehículos y boletas de honorarios de la receptora judicial de Curanilahue.',
          lang: 'es-CL',
          start_url: './',
          scope: './',
          display: 'standalone',
          orientation: 'any',
          theme_color: '#0E4D57',
          background_color: '#F4F6F5',
          icons: [
            { src: 'icono-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icono-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'icono-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          // Se guardan todos los archivos de la app para que funcione sin internet
          globPatterns: ['**/*.{js,mjs,css,html,svg,png,woff,woff2}'],
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          navigateFallback: 'index.html',
          cleanupOutdatedCaches: true,
        },
      }),
  ],
})

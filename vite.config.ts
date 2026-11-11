import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// Configuración de Vite. "base: './'" permite publicar la app en cualquier carpeta (por ejemplo, GitHub Pages).
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
})

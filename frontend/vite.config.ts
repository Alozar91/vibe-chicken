import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// BASE_PATH задаётся при сборке для публикации за системным nginx по пути /chicken
// (см. docs/deploy.md). В разработке не задан → база «/», /api проксируется на FastAPI.
const basePath = process.env.BASE_PATH ?? '/'

// https://vite.dev/config/
export default defineConfig({
  base: basePath,
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // В разработке /api уходит на FastAPI, куки работают без CORS
      '/api': 'http://localhost:8000',
    },
  },
})

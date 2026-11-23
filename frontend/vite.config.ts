import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // В разработке /api уходит на FastAPI, куки работают без CORS
      '/api': 'http://localhost:8000',
    },
  },
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['ckeditor5', '@ckeditor/ckeditor5-react', 'fuzzysort', 'pdfjs-dist', 'jszip'],
    needsInterop: ['fuzzysort'],
  },
})

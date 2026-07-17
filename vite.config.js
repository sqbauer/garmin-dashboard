import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Build to docs/ so GitHub Pages can serve from docs/ on the main branch
  build: { outDir: 'docs', emptyOutDir: true },
  // Serve /data/garmin.json from the repo root data/ folder during dev
  publicDir: 'public',
})

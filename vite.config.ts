import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// A strict Content-Security-Policy for the built app: only its own scripts,
// no plugins or forms, and the one outside address it may call is the
// dictionary, which is off until the reader turns it on.
const CSP = [
  "default-src 'self'", "script-src 'self'", "style-src 'self' 'unsafe-inline'", "img-src 'self' blob: data:",
  "font-src 'self' blob: data:", "worker-src 'self' blob:", "connect-src 'self' blob: data: https://api.dictionaryapi.dev",
  "frame-src 'self'", "object-src 'none'", "base-uri 'none'", "form-action 'none'",
].join('; ')
const csp: Plugin = { name: 'csp', apply: 'build', transformIndexHtml: (html) => html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}">`) }

export default defineConfig({
  base: './',
  plugins: [react(), csp],
  resolve: { dedupe: ['react', 'react-dom', 'pdfjs-dist'] },
  // The plugins ship as TypeScript source: compile them like the app's own files.
  optimizeDeps: { exclude: ['@wittywilla/wittyink', '@wittywilla/wittyebook', '@wittywilla/wittypdf', '@wittywilla/wittycomics'] },
  build: { outDir: 'dist', emptyOutDir: true, sourcemap: false },
  server: { port: 5180 },
})

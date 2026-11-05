import { copyFileSync, mkdirSync, readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
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

// pdf.js fetches its image decoders and colour profiles by name, from a folder it
// is told about, so they can't go through the bundler. The folder carries pdf.js's
// version, so a new one is never mixed with an old copy kept for offline use. The
// script engine for PDF scripts stays behind: PDF scripts never run here. Their
// licences go with them.
const pdfVersion = String(JSON.parse(readFileSync(new URL('./node_modules/pdfjs-dist/package.json', import.meta.url), 'utf8')).version)
const pdfAssets: Plugin = {
  name: 'pdf-assets', apply: 'build',
  closeBundle() {
    for (const [from, match] of [['wasm', /^((openjpeg|jbig2|qcms).*\.(wasm|js)|LICENSE_.*)$/], ['iccs', /\.icc$|^LICENSE$/]] as const) {
      const src = fileURLToPath(new URL(`./node_modules/pdfjs-dist/${from}/`, import.meta.url))
      const dst = fileURLToPath(new URL(`./dist/assets/pdfjs-${pdfVersion}/${from}/`, import.meta.url))
      mkdirSync(dst, { recursive: true })
      for (const f of readdirSync(src)) if (match.test(f)) copyFileSync(src + f, dst + f)
    }
  },
}

export default defineConfig(({ command }) => ({
  base: './',
  plugins: [react(), csp, pdfAssets],
  // While developing, the same files straight from node_modules.
  define: { __PDF_ASSETS__: JSON.stringify(command === 'build' ? `assets/pdfjs-${pdfVersion}/` : '/node_modules/pdfjs-dist/') },
  resolve: { dedupe: ['react', 'react-dom', 'pdfjs-dist'] },
  // The plugins ship as TypeScript source: compile them like the app's own files.
  optimizeDeps: { exclude: ['@wittywilla/wittyink', '@wittywilla/wittyebook', '@wittywilla/wittypdf', '@wittywilla/wittycomics'] },
  // The browsers this app has always reached, whatever the bundler's default is now.
  build: { outDir: 'dist', emptyOutDir: true, sourcemap: false, target: ['es2020', 'edge88', 'firefox78', 'chrome87', 'safari14'] },
  server: { port: 5180 },
}))

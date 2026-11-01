// How the app's own address maps to its files. Nothing here needs Electron, so it can be tested alone.
const path = require('path')

const SCHEME = 'wittyreader'
const HOST = 'app'
const ORIGIN = `${SCHEME}://${HOST}`
// One-time addresses for files opened from the system. The service worker leaves these alone.
const OPENED_PREFIX = '/__opened__/'

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
  '.map': 'application/json',
}

const contentType = (file) => TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream'

// The file an address means, or null if it means nothing inside the app's folder. A URL parser has
// already resolved plain "..", but one escaped as %2e or %2f only appears on decoding.
function resolveAppFile(root, pathname) {
  let decoded
  try { decoded = decodeURIComponent(pathname) } catch { return null }
  if (decoded.includes('\0') || decoded.includes('\\')) return null
  const relative = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '')
  if (!relative || relative.split('/').some((part) => part === '..')) return null
  const full = path.resolve(root, relative)
  const inside = path.resolve(root) + path.sep
  return full.startsWith(inside) ? full : null
}

module.exports = { SCHEME, HOST, ORIGIN, OPENED_PREFIX, contentType, resolveAppFile }

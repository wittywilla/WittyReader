// WittyReader's service worker. It serves the unpacked files of the open
// EPUB (stored in Cache Storage with a strict Content-Security-Policy when
// the book is opened), and keeps the app itself working offline after the
// first visit. Nothing here talks to any other site.
const APP = 'wittyreader-app-v1'
const BOOK = 'wittyreader-book'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k.startsWith('wittyreader-app-') && k !== APP) await caches.delete(k)
  await self.clients.claim()
})()))

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  const scope = new URL(self.registration.scope)
  // A file opened from the system in the desktop app: read once, and not worth keeping a copy of.
  if (url.pathname.startsWith(scope.pathname + '__opened__/')) return
  if (url.pathname.startsWith(scope.pathname + 'book/')) {
    e.respondWith(caches.open(BOOK)
      // Under a made-up address, because Cache Storage only takes http and https: see src/epub.ts.
      .then((c) => c.match('https://wittyreader-book.invalid' + url.pathname))
      .then((r) => r || new Response('Not in this book', { status: 404, headers: { 'Content-Type': 'text/plain' } })))
    return
  }
  // The app's own files: the network first, the copy from the last visit when offline.
  e.respondWith(fetch(req).then((res) => {
    // The desktop app's own files are always there, and Cache Storage wouldn't take their address.
    if (res.ok && res.type === 'basic' && url.protocol.startsWith('http')) { const copy = res.clone(); caches.open(APP).then((c) => c.put(req, copy)) }
    return res
  }).catch(() => caches.match(req).then((r) => r || caches.match(scope.href)).then((r) => r || Response.error())))
})

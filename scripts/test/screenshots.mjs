#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WittyWilla and contributors
// Takes the pictures in docs/images from the built app, in headless Chrome, with a library of made-up books whose covers are drawn
// here (no one's media). Needs Chrome, cwebp, and the built app served (npm run build; npx vite preview --port 19871) with the
// generated books from make-books.mjs in dist/_t/.
//
//   node scripts/test/screenshots.mjs <output folder> [app address]
import { spawn, execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = process.argv[2]
const app = process.argv[3] || 'http://localhost:19871/'
const chrome = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const port = 19872
mkdirSync(out, { recursive: true })
const profile = mkdtempSync(join(tmpdir(), 'wr-shots-'))
const proc = spawn(chrome, [`--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--headless=new', '--no-first-run', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let ws, id = 0
const waiting = new Map()
async function connect() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
      const page = list.find((t) => t.type === 'page')
      if (page) { ws = new WebSocket(page.webSocketDebuggerUrl); await new Promise((r, j) => { ws.onopen = r; ws.onerror = j }); break }
    } catch { /* not up yet */ }
    await sleep(500)
  }
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && waiting.has(d.id)) { waiting.get(d.id)(d); waiting.delete(d.id) } }
}
const send = (method, params = {}) => new Promise((resolve, reject) => { const n = ++id; waiting.set(n, (d) => (d.error ? reject(new Error(d.error.message)) : resolve(d.result))); ws.send(JSON.stringify({ id: n, method, params })) })
const run = async (expression) => { const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'script failed'); return r.result.value }
const go = async (url) => { await send('Page.navigate', { url }); await sleep(2500) }
async function shot(name, w = 1440, h = 900) {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false })
  await sleep(1200)
  const { data } = await send('Page.captureScreenshot', { format: 'png' })
  const png = join(profile, name + '.png')
  writeFileSync(png, Buffer.from(data, 'base64'))
  execFileSync('cwebp', ['-q', '82', '-quiet', png, '-o', join(out, name + '.webp')])
  console.log('wrote', name + '.webp')
}

// The made-up library: titles, authors and covers invented and drawn here.
const BOOKS = [
  ['The Lantern Keeper', 'Mara Quill', 'epub', 62], ['Salt and Static', 'Odo Fennimore', 'epub', 0], ['A Short Atlas of Rain', 'Ines Tavares', 'pdf', 100], ['Hollow Crown Vol. 1', 'Tess Wren', 'cbz', 35],
  ['The Cartographer’s Daughter', 'Mara Quill', 'epub', 12], ['Field Notes on Silence', 'Ravi Anand', 'pdf', 0], ['Night Market', 'Yuki Aoyama', 'cbz', 0], ['Ten Thousand Small Boats', 'Odo Fennimore', 'epub', 100],
  ['Copper Weather', 'Ines Tavares', 'epub', 48], ['Orbit Diary', 'Tess Wren', 'cbz', 80], ['The Quiet Orchard', 'Ravi Anand', 'epub', 0], ['Maps of Almost', 'Yuki Aoyama', 'pdf', 22],
]
const seed = `(async () => {
  const BOOKS = ${JSON.stringify(BOOKS)}
  const cover = async (title, hue) => {
    const c = new OffscreenCanvas(300, 450), x = c.getContext('2d')
    const g = x.createLinearGradient(0, 0, 300, 450); g.addColorStop(0, 'hsl(' + hue + ' 45% 38%)'); g.addColorStop(1, 'hsl(' + ((hue + 50) % 360) + ' 50% 16%)'); x.fillStyle = g; x.fillRect(0, 0, 300, 450)
    x.fillStyle = 'hsla(' + ((hue + 180) % 360) + ' 70% 75% / .25)'; x.beginPath(); x.arc(220, 120, 90, 0, 7); x.fill()
    x.fillStyle = '#fff'; x.font = '600 30px Georgia, serif'; const words = title.split(' '); let line = '', y = 300
    for (const w of words) { if (x.measureText(line + w).width > 250) { x.fillText(line, 24, y); y += 36; line = '' } line += w + ' ' } x.fillText(line, 24, y)
    return c.convertToBlob({ type: 'image/png' })
  }
  const db = await new Promise((res, rej) => { const r = indexedDB.open('wittyreader', 1); r.onupgradeneeded = () => { const d = r.result; d.createObjectStore('books', { keyPath: 'key' }); d.createObjectStore('files'); d.createObjectStore('notes', { keyPath: 'id', autoIncrement: true }).createIndex('book', 'book') }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })
  const recs = []
  let i = 0
  for (const [title, author, format, pct] of BOOKS) {
    const total = format === 'epub' ? 20 : 120
    recs.push({ key: 'demo' + (i++).toString().padStart(2, '0'), name: title + '.' + format, title, author, format, size: 1e6, added: Date.now() - i * 86400000, opened: pct ? Date.now() - i * 3600000 : 0, position: pct ? Math.min(total - 1, Math.floor(total * pct / 100)) : 0, total, words: format === 'epub' ? Array(total).fill(1000) : undefined, cover: await cover(title, (i * 47) % 360) })
  }
  await new Promise((res) => { const t = db.transaction(['books', 'notes'], 'readwrite'); for (const r of recs) t.objectStore('books').put(r)
    const n = t.objectStore('notes'); const mk = (b, o) => n.add({ kind: 'highlight', chapter: 1, pos: 1, quote: '', prefix: '', suffix: '', color: 'yellow', note: '', created: 1, book: recs[b].key, ...o })
    mk(0, { quote: 'The lamp was older than the lighthouse, and it knew it.', note: 'Opening image' }); mk(0, { quote: 'Light is only a promise somebody keeps.', color: 'blue', chapter: 4 }); mk(8, { quote: 'It rained copper that year, and the roofs sang.', color: 'pink', note: 'Quote for the essay' }); mk(2, { kind: 'bookmark', chapter: 30, color: '' }); mk(7, { quote: 'Every boat was a small yes.', color: 'green', chapter: 9 })
    t.oncomplete = res })
  return recs.length
})()`
const look = (theme, lk) => `localStorage.setItem('wittyreader.firstRun','1'); localStorage.setItem('wittyreader.theme', '${theme}'); localStorage.setItem('wittyreader.look', '${lk}'); 1`
try {
  await connect()
  await send('Page.enable')
  await go(app)
  await run(seed)
  const views = [['reader-library', 'default', 'lumen', '#/'], ['reader-theme-aero', 'look', 'aero', '#/'], ['reader-theme-paper', 'look', 'paper', '#/'], ['reader-theme-teletext', 'look', 'retro', '#/'], ['reader-theme-midnight', 'midnight', 'stage', '#/']]
  for (const [name, theme, lk, hash] of views) {
    await run(look(theme, lk)); await go(app + hash); await run('location.reload()').catch(() => {}); await sleep(2500)
    await shot(name)
  }
  await run(look('default', 'lumen'))
  for (const [name, hash] of [['reader-notes', '#/notes'], ['reader-settings', '#/settings'], ['reader-book-page', '#/book/demo00'], ['reader-shelf', '#/shelf']]) {
    await go(app + hash); await run(`location.hash='${hash}'; location.reload()`).catch(() => {}); await sleep(2500)
    await shot(name)
  }
  // A book open: the made-up EPUB from make-books.mjs, added and read.
  await go(app + '#/')
  await run(`(async () => { const b = await (await fetch('_t/' + encodeURIComponent('A Made-Up Book.epub'))).blob(); const dt = new DataTransfer(); dt.items.add(new File([b], 'A Made-Up Book.epub')); const i = document.querySelector('input[type=file][multiple]'); i.files = dt.files; i.dispatchEvent(new Event('change', { bubbles: true })) })()`)
  await sleep(6000)
  await shot('reader-book')
} finally { proc.kill(); await sleep(1500); rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 }) }

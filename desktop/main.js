// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WittyWilla and contributors
// WittyReader for Windows, macOS and Linux: one window showing the same app as the web version,
// from its built files, through an address of its own. The page has no access to Node, and the
// only things it can reach outside the app are the dictionary, which the reader has to turn on,
// and the servers the reader has added (origins.js): exactly their origins, in the page's policy and again in the
// session's request filter, and no others.
const { app, BrowserWindow, Menu, ipcMain, protocol, session, shell } = require('electron')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const { Readable } = require('stream')
const { booksIn } = require('./opened.js')
const { allowedRequest, cleanList, originOf, rewriteHtml } = require('./origins.js')
const { SCHEME, HOST, ORIGIN, OPENED_PREFIX, contentType, resolveAppFile } = require('./serve.js')

const WEB_ROOT = app.isPackaged ? path.join(__dirname, 'app') : path.join(__dirname, '..', 'dist')
const DICTIONARY = 'https://api.dictionaryapi.dev/'
// The most the app can hold in memory while adding a file.
const MAX_BOOK_BYTES = 2 * 1024 * 1024 * 1024 - 1
// Copy and citations, and keeping the library when the disk runs low. Nothing else is ever granted.
const ALLOWED_PERMISSIONS = new Set(['clipboard-sanitized-write', 'persistent-storage'])
const SIZE_FILE = () => path.join(app.getPath('userData'), 'window.json')
const SERVERS_FILE = () => path.join(app.getPath('userData'), 'servers.json')

// The servers the reader added: origins only, kept in the app's own folder, and read again for every page it serves.
let servers = []
function loadServers() { try { servers = cleanList(JSON.parse(fs.readFileSync(SERVERS_FILE(), 'utf8'))) } catch { servers = [] } }
function saveServers() { try { fs.writeFileSync(SERVERS_FILE(), JSON.stringify(servers)) } catch { /* they are asked for again next time */ } }

let win = null
let bookQueue = []
let pageReady = false
const opened = new Map() // one-time address -> the file it stands for

// Secure and standard, so the page gets the same abilities as on https: its database, its service
// worker (which shows EPUB books) and hashing. This has to be said before the app is ready.
protocol.registerSchemesAsPrivileged([{
  scheme: SCHEME,
  privileges: { standard: true, secure: true, supportFetchAPI: true, allowServiceWorkers: true, stream: true, codeCache: true },
}])

const notFound = () => new Response('Not here', { status: 404, headers: { 'Content-Type': 'text/plain' } })

async function answer(request) {
  const url = new URL(request.url)
  if (url.host !== HOST || request.method !== 'GET') return notFound()

  if (url.pathname.startsWith(OPENED_PREFIX)) {
    const file = opened.get(url.pathname)
    opened.delete(url.pathname)
    if (!file) return notFound()
    const stream = Readable.toWeb(fs.createReadStream(file))
    return new Response(stream, { headers: { 'Content-Type': 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' } })
  }

  const file = resolveAppFile(WEB_ROOT, url.pathname)
  if (!file) return notFound()
  try {
    let body = await fs.promises.readFile(file)
    // The page's own policy, with the added servers' origins in connect-src and img-src.
    if (path.basename(file) === 'index.html') body = Buffer.from(rewriteHtml(body.toString('utf8'), servers))
    return new Response(body, { headers: { 'Content-Type': contentType(file), 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-cache' } })
  } catch {
    return notFound()
  }
}

// Only web and mail links leave the app: anything else could open programs or files.
function openOutside(url) {
  try {
    const u = new URL(url)
    if (['http:', 'https:', 'mailto:'].includes(u.protocol)) shell.openExternal(u.href)
  } catch { /* not a link */ }
}

function isOurs(url) {
  // Not by its origin: Node gives every address on a scheme it doesn't know the origin "null".
  try {
    const u = new URL(url)
    return u.protocol === `${SCHEME}:` && u.host === HOST
  } catch { return false }
}

function guard(contents) {
  contents.setWindowOpenHandler(({ url }) => { openOutside(url); return { action: 'deny' } })
  const stay = (event, url) => {
    if (isOurs(url)) return
    event.preventDefault()
    openOutside(url)
  }
  contents.on('will-navigate', stay)
  contents.on('will-redirect', stay)
  contents.on('will-attach-webview', (event) => event.preventDefault())
}

function lockDown() {
  // Otherwise the engine fetches a spelling dictionary from a third party, even with spelling off in the page.
  session.defaultSession.setSpellCheckerEnabled(false)
  if (process.platform !== 'darwin') session.defaultSession.setSpellCheckerLanguages([])
  const allowed = (permission, origin) => ALLOWED_PERMISSIONS.has(permission) && isOurs(origin)
  session.defaultSession.setPermissionRequestHandler((contents, permission, done, details) => done(allowed(permission, details.requestingUrl || contents.getURL())))
  session.defaultSession.setPermissionCheckHandler((_contents, permission, origin) => allowed(permission, origin))
  // The app's own policy already says this. This is the same rule again, from outside the page.
  session.defaultSession.webRequest.onBeforeRequest({ urls: ['*://*/*'] }, (details, done) => {
    done({ cancel: /^(https?|wss?|ftp):/i.test(details.url) && !allowedRequest(details.url, DICTIONARY, servers) })
  })
}

// The page's theme colour, painted behind it, so opening or resizing the window shows no flash
// of another colour. Only a plain #rrggbb is taken from the page.
const HEX = /^#[0-9a-f]{6}$/i
let background = '#0f1115'

function savedSize() {
  let size = { width: 1200, height: 800 }
  try {
    const kept = JSON.parse(fs.readFileSync(SIZE_FILE(), 'utf8'))
    if (kept.width >= 480 && kept.height >= 360 && kept.width <= 16384 && kept.height <= 16384) size = { width: kept.width, height: kept.height }
    if (typeof kept.background === 'string' && HEX.test(kept.background)) background = kept.background
  } catch { /* the first run, or a damaged file */ }
  return size
}

function saveSize() {
  if (!win) return
  let size = {}
  try { size = JSON.parse(fs.readFileSync(SIZE_FILE(), 'utf8')) } catch { /* nothing kept yet */ }
  if (!win.isMaximized() && !win.isFullScreen()) { const [width, height] = win.getSize(); size = { width, height } }
  try { fs.writeFileSync(SIZE_FILE(), JSON.stringify({ width: size.width, height: size.height, background })) } catch { /* it just opens at the usual size */ }
}

// The page asks for a server to be added or removed; the origin is checked here, not trusted from the page. The page is
// reloaded so its policy (read once per page) shows the new list, and is told which address to carry on with.
const fromPage = (event) => win && event.sender === win.webContents && isOurs(event.senderFrame?.url || '')
ipcMain.handle('servers:list', (event) => (fromPage(event) ? servers.slice() : []))
ipcMain.handle('servers:add', (event, input, hash) => {
  const origin = originOf(input)
  if (!fromPage(event) || !origin) return null
  if (!servers.includes(origin)) { servers = cleanList([...servers, origin]); saveServers() }
  if (!servers.includes(origin)) return null // the list is full
  if (win) win.loadURL(`${ORIGIN}/#${typeof hash === 'string' && /^\/[\w/?=&%.:-]*$/.test(hash) ? hash : '/connect'}`)
  return origin
})
ipcMain.handle('servers:remove', (event, input) => {
  const origin = originOf(input)
  if (!fromPage(event) || !origin) return false
  servers = servers.filter((o) => o !== origin)
  saveServers()
  if (win) win.webContents.reload()
  return true
})

ipcMain.on('background', (event, colour) => {
  if (!win || event.sender !== win.webContents || !isOurs(event.senderFrame?.url || '') || typeof colour !== 'string' || !HEX.test(colour)) return
  background = colour
  win.setBackgroundColor(colour)
})

function createWindow() {
  win = new BrowserWindow({
    ...savedSize(), minWidth: 480, minHeight: 360, backgroundColor: background, title: 'WittyReader', show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, sandbox: true, nodeIntegration: false, webSecurity: true, spellcheck: false,
      safeDialogs: true, devTools: !app.isPackaged,
    },
  })
  win.once('ready-to-show', () => win.show())
  win.on('close', saveSize)
  win.on('closed', () => { win = null })
  win.webContents.on('did-finish-load', () => { pageReady = true; sendBooks() })
  win.loadURL(`${ORIGIN}/`)
}

// Hands waiting books to the page, each behind an address that works once.
function sendBooks() {
  if (!win || !pageReady || !bookQueue.length) return
  const batch = bookQueue
  bookQueue = []
  const books = []
  for (const file of batch) {
    const name = path.basename(file)
    let size = 0
    try { size = fs.statSync(file).size } catch { continue }
    if (size > MAX_BOOK_BYTES) { books.push({ name, error: `${name} is too big to add: the limit is 2 GB.` }); continue }
    const address = OPENED_PREFIX + crypto.randomUUID()
    opened.set(address, file)
    books.push({ name, url: ORIGIN + address })
  }
  if (books.length) win.webContents.send('books-opened', books)
}

function openBooks(files) {
  bookQueue.push(...files)
  sendBooks()
}

function toFront() {
  if (!win) return
  if (win.isMinimized()) win.restore()
  win.focus()
}

// macOS has its Edit menu here, or copying and pasting wouldn't work. Elsewhere the app has none.
function applicationMenu() {
  if (process.platform !== 'darwin') return null
  return Menu.buildFromTemplate([{ role: 'appMenu' }, { role: 'editMenu' }, { role: 'windowMenu' }])
}

// One window only, not least because one database can't have two owners.
if (!app.requestSingleInstanceLock()) app.quit()
else {
  app.enableSandbox()
  bookQueue = booksIn(process.argv.slice(1), process.cwd())
  app.on('second-instance', (_event, argv, cwd) => { openBooks(booksIn(argv.slice(1), cwd)); toFront() })
  // How macOS says it: this can come before the app is ready.
  app.on('open-file', (event, file) => { event.preventDefault(); openBooks(booksIn([file], '/')); toFront() })
  app.on('web-contents-created', (_event, contents) => guard(contents))
  app.whenReady().then(() => {
    Menu.setApplicationMenu(applicationMenu())
    loadServers()
    lockDown()
    protocol.handle(SCHEME, answer)
    createWindow()
  }).catch((err) => {
    // There's no window and never will be, and an app with none can't be closed.
    console.error(err)
    app.exit(1)
  })
  app.on('window-all-closed', () => app.quit())
}

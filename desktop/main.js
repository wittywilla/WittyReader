// WittyReader for Windows, macOS and Linux: one window showing the same app as the web version,
// from its built files, through an address of its own. The page has no access to Node, and the
// only thing it can reach outside the app is the dictionary, which the reader has to turn on.
const { app, BrowserWindow, Menu, protocol, session, shell } = require('electron')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const { Readable } = require('stream')
const { booksIn } = require('./opened.js')
const { SCHEME, HOST, ORIGIN, OPENED_PREFIX, contentType, resolveAppFile } = require('./serve.js')

const WEB_ROOT = app.isPackaged ? path.join(__dirname, 'app') : path.join(__dirname, '..', 'dist')
const DICTIONARY = 'https://api.dictionaryapi.dev/'
// The most the app can hold in memory while adding a file.
const MAX_BOOK_BYTES = 2 * 1024 * 1024 * 1024 - 1
// navigator.clipboard.writeText, for Copy and citations. Nothing else is ever granted.
const ALLOWED_PERMISSIONS = new Set(['clipboard-sanitized-write'])
const SIZE_FILE = () => path.join(app.getPath('userData'), 'window.json')

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
    const body = await fs.promises.readFile(file)
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
  try { return new URL(url).origin === ORIGIN } catch { return false }
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
  const allowed = (permission, origin) => ALLOWED_PERMISSIONS.has(permission) && isOurs(origin)
  session.defaultSession.setPermissionRequestHandler((_contents, permission, done, details) => done(allowed(permission, details.requestingUrl)))
  session.defaultSession.setPermissionCheckHandler((_contents, permission, origin) => allowed(permission, origin))
  // The app's own policy already says this. This is the same rule again, from outside the page.
  session.defaultSession.webRequest.onBeforeRequest({ urls: ['*://*/*'] }, (details, done) => {
    done({ cancel: /^(https?|wss?|ftp):/i.test(details.url) && !details.url.startsWith(DICTIONARY) })
  })
}

function savedSize() {
  try {
    const { width, height } = JSON.parse(fs.readFileSync(SIZE_FILE(), 'utf8'))
    if (width >= 480 && height >= 360 && width <= 16384 && height <= 16384) return { width, height }
  } catch { /* the first run, or a damaged file */ }
  return { width: 1200, height: 800 }
}

function saveSize() {
  if (!win || win.isMaximized() || win.isFullScreen()) return
  const [width, height] = win.getSize()
  try { fs.writeFileSync(SIZE_FILE(), JSON.stringify({ width, height })) } catch { /* it just opens at the usual size */ }
}

function createWindow() {
  win = new BrowserWindow({
    ...savedSize(), minWidth: 480, minHeight: 360, backgroundColor: '#0f1115', title: 'WittyReader', show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, sandbox: true, nodeIntegration: false, webSecurity: true, spellcheck: false,
    },
  })
  win.once('ready-to-show', () => win.show())
  win.on('close', saveSize)
  win.on('closed', () => { win = null })
  win.webContents.on('did-finish-load', () => { pageReady = true; sendBooks() })
  win.webContents.on('did-start-loading', () => { pageReady = false })
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

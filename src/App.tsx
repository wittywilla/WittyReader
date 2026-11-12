// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WittyWilla and contributors
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import WittyComics from '@wittywilla/wittycomics'
import WittyEbook from '@wittywilla/wittyebook'
import { HostContext, type ReaderHost } from '@wittywilla/wittyink'
import { exportNotesFile, importFile, importNotesFile, openBook } from './books'
import { Shell } from './Shell'
import { books } from './store'
import { dictionaryOn, DICT_KEY, loadData } from './pages/data'
import { desktop, forget, inUse, keep, originOf, placed, pollPairing, savedServers, SERVER_RULES, startPairing, use, type Pairing, type Saved } from './pages/connection.ts'
import { remote } from './pages/remote.ts'
import { navigation, page as buildDocument, registerCommands, ROUTES } from './pages/local.ts'
import { layoutFor } from './pages/doc.ts'
import { bookOfShelfId } from './pages/shelfHost'
import { PageView, type Handlers } from './pages/PageView'
import { request, type Host } from './pages/requests.ts'
import { chooseLook, chooseTheme, addImported, finishFirstRun, firstRunDone, removeImported } from './theme/engine'
import { readThemeZip, ThemeError } from './theme/importTheme'
import { IconPlus as IconAdd } from './web/icons'
import { canGoBack, currentLocation, navigate, useLocation } from './web/router'
import { describe } from './web/sdui/device.ts'
import { plan, resolve, withQuery } from './web/sdui/routes.ts'
import type { View } from './web/sdui/model.ts'
import type { Action, Document } from './web/sdui/types.ts'

// WittyReader: a library of books, PDFs and comics kept on this device, read with the WittyEbook, WittyPDF and
// WittyComics plugins. Every screen but the reading surface is a server-driven page (SDUI), made by the local
// page provider (src/pages) and drawn by the server's own renderer (src/web): see docs/SDUI-ARCHITECTURE.md.
// Nothing leaves the device unless the reader turns on the online dictionary.

const WittyPDF = lazy(() => import('@wittywilla/wittypdf'))
const ACCEPT = '.epub,.pdf,.cbz,application/epub+zip,application/pdf'
const VERSION = __APP_VERSION__
registerCommands()

const save = (name: string, blob: Blob) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = name; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function useWindow() {
  const [size, setSize] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }))
  useEffect(() => { const f = () => setSize({ w: window.innerWidth, h: window.innerHeight }); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f) }, [])
  return size
}

export default function App() {
  const loc = useLocation()
  // Connected to a server (its pages under /s), or pairing with one.
  const [servers, setServers] = useState<Saved[]>(savedServers)
  const conn = inUse(servers)
  const bridge = desktop()
  const [pairing, setPairing] = useState<(Pairing & { shown: string; error?: string }) | null>(null)
  const route = useMemo(() => resolve(loc.pathname, loc.search, conn ? [...ROUTES, ...SERVER_RULES] : ROUTES), [loc.pathname, loc.search, conn])
  const size = useWindow()
  const [version, setVersion] = useState(0) // changes when what a page is made from does
  const [doc, setDoc] = useState<Document | null | undefined>(undefined)
  const [busy, setBusy] = useState('')
  const [drag, setDrag] = useState(false)
  const [msg, setMsg] = useState('')
  const picker = useRef<HTMLInputElement | null>(null)
  const notesPicker = useRef<HTMLInputElement | null>(null)
  const themePicker = useRef<HTMLInputElement | null>(null)
  const msgTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const toast = useCallback((m: string) => { setMsg(m); if (msgTimer.current) clearTimeout(msgTimer.current); msgTimer.current = setTimeout(() => setMsg(''), 3500) }, [])
  const beginPairing = useCallback(async (base: string) => {
    setBusy('Asking the server…')
    try { const p = await startPairing(base, 'WittyReader'); setPairing({ ...p, shown: p.pin }) } catch (e) { toast((e as Error).message) } finally { setBusy('') }
  }, [toast])
  const refresh = useCallback(() => setVersion((v) => v + 1), [])
  const reading = route?.kind === 'native' && route.screen === 'reader' ? route.vars.item : ''
  const dictionary = useRef(dictionaryOn())

  // A book that was read has new progress: the library is made again when it closes.
  useEffect(() => { if (!reading) refresh() }, [reading, refresh])

  // The bookshelf view opens a book with a path of its own (\`/item/<n>\`) through the History API: it is the book's page here.
  useEffect(() => {
    const open = () => {
      const m = /\/item\/(\d+)$/.exec(location.pathname)
      if (!m) return
      const key = bookOfShelfId(Number(m[1]))
      history.replaceState(history.state, '', location.pathname.replace(/\/item\/\d+$/, '/') + location.search + location.hash)
      if (key) navigate(`/book/${key}`)
    }
    window.addEventListener('popstate', open)
    return () => window.removeEventListener('popstate', open)
  }, [])

  // After the desktop app added a server and reloaded the page: carry on with pairing it (the address came back in the hash).
  useEffect(() => {
    if (loc.pathname !== '/connect' || !bridge) return
    const want = originOf(new URLSearchParams(loc.search).get('pair'))
    if (!want) return
    navigate('/connect', true)
    void bridge.servers?.().then((list) => { if (list.includes(want)) void beginPairing(want) })
  }, [loc.pathname, loc.search]) // eslint-disable-line react-hooks/exhaustive-deps

  // A server the desktop app no longer lets the page call has no use here: its sign-in is dropped.
  useEffect(() => {
    void bridge?.servers?.().then((list) => { const keepOnly = savedServers().filter((x) => list.includes(x.base)); if (keepOnly.length !== savedServers().length) { savedServers().filter((x) => !list.includes(x.base)).forEach((x) => forget(x.base)); setServers(savedServers()) } })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // While pairing, the server is asked every few seconds: approved, the token is kept and the server's pages open.
  useEffect(() => {
    if (!pairing) return
    const p = pairing
    const t = setInterval(async () => {
      try {
        const r = await pollPairing(p)
        if (r.status === 'approved' && r.token) { setServers(keep({ base: p.base, token: r.token, user: r.user })); setPairing(null); navigate('/s', true); toast('Connected.') }
        else if (r.status === 'denied' || r.status === 'expired' || r.status === 'locked') { setPairing(null); toast(r.status === 'denied' ? 'The server refused this device.' : 'That code ran out. Start again.') }
        else if (r.pin && r.pin !== p.shown) setPairing((cur) => (cur ? { ...cur, shown: r.pin! } : cur))
      } catch { setPairing((cur) => (cur ? { ...cur, error: 'Can’t reach the server right now. Still trying.' } : cur)) }
    }, p.intervalSec * 1000)
    return () => clearInterval(t)
  }, [pairing?.sessionId]) // eslint-disable-line react-hooks/exhaustive-deps

  // The first time, the app asks how it should look.
  useEffect(() => { if (!firstRunDone() && loc.pathname !== '/welcome' && !reading) navigate('/welcome', true) }, [loc.pathname, reading])

  // ---- the page on screen: made from the library, drawn by the renderer
  const device = useMemo(() => describe({ width: size.w, height: size.h, tvMode: false, desktopShell: !!(window as unknown as { wittyReaderDesktop?: unknown }).wittyReaderDesktop,
    touch: matchMedia('(pointer: coarse)').matches, pointer: matchMedia('(pointer: fine)').matches, reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches, hdr: false, locale: navigator.language || 'en', uhd: false }), [size.w, size.h])
  useEffect(() => {
    if (!route || route.kind !== 'page') { setDoc(undefined); return }
    let live = true
    // A page of the connected server: asked for from it, and drawn by the same renderer.
    if (conn && route.page.startsWith('server:')) {
      remote(conn).page(route.page.slice(7), device, Object.fromEntries([...new URLSearchParams(loc.search), ...Object.entries(route.params)])).then((d) => live && setDoc(placed(d))).catch((e: Error) => { if (live) { toast(e.message); setDoc(null) } })
      return () => { live = false }
    }
    loadData(VERSION, { canConnect: !!bridge, servers: servers.map((x) => ({ base: x.base, user: x.user, active: x === conn })), pairing: pairing ? { base: pairing.base, pin: pairing.shown, approveUrl: pairing.approveUrl, error: pairing.error } : undefined }).then((data) => {
      if (!live) return
      const layout = layoutFor(size.w, size.h, { touch: device.capabilities.includes('touch') && !device.capabilities.includes('pointer'), desktopShell: device.platform === 'desktop', reducedMotion: device.capabilities.includes('reducedMotion') })
      setDoc(buildDocument(route.page, new URLSearchParams([...new URLSearchParams(loc.search), ...Object.entries(route.params)]), data, layout))
    }).catch(() => live && setDoc(null))
    return () => { live = false }
  }, [route, loc.search, version, size.w, size.h, device, servers, pairing, toast])
  useEffect(() => { document.title = doc ? `${doc.page.title} · WittyReader` : 'WittyReader' }, [doc])

  // ---- what a page's commands do
  const host: Host = useMemo(() => ({
    toast,
    pick: (what) => (what === 'books' ? picker : what === 'notes' ? notesPicker : themePicker).current?.click(),
    removeBook: async (key) => {
      if (!(await books.get(key))) return
      await books.remove(key)
      if (currentLocation().pathname.startsWith('/book/')) navigate('/', true)
      refresh()
    },
    exportBook: async (key) => { const rec = await books.get(key); if (rec) await exportNotesFile(rec) },
    notes: async () => (await loadData(VERSION)).notes,
    save,
    setDictionary: () => { dictionary.current = !dictionary.current; try { localStorage.setItem(DICT_KEY, dictionary.current ? '1' : '0') } catch { /* this visit only */ } refresh() },
    setTheme: async (id) => { await chooseTheme(id); refresh() },
    setLook: async (id) => { await chooseLook(id); refresh() },
    removeTheme: async (id) => { await removeImported(id); refresh() },
    refresh,
    connect: async (what, server) => {
      if (what === 'cancel') { setPairing(null); return }
      const base = originOf(server || '')
      if (!base) { toast('Type just the server’s address, such as 192.168.1.20:9797: no path, no sign-in, no wildcard.'); return }
      if (!bridge) { toast('Connecting needs the WittyReader desktop app.'); return }
      // The page's policy lets it call only the servers added: the desktop app adds this one and reloads the page, which carries on.
      if (!(await bridge.servers?.())?.includes(base)) { if (!(await bridge.addServer?.(base, '/connect?pair=' + encodeURIComponent(base)))) toast('That server could not be added (up to eight).'); return }
      await beginPairing(base)
    },
    server: async (what, server) => {
      const base = originOf(server)
      if (!base) return
      if (what === 'use') { setServers(use(base)); return }
      setServers(forget(base))
      await bridge?.removeServer?.(base) // the page's policy loses the origin, and the page reloads
    },
    finishWelcome: () => { finishFirstRun(); navigate('/', true) },
  }), [toast, refresh])

  const handlers: Handlers = useMemo(() => ({
    act: (a: Action | undefined, from?: View) => {
      void from
      // A command can ask first (docs/SDUI.md, `confirm`): it runs only on a yes.
      if (a?.confirm && !confirm(a.confirm)) return
      const step = plan(a)
      switch (step.do) {
        case 'go': navigate(step.to); break
        case 'back': history.back(); break
        case 'open': window.open(step.url, '_blank', 'noopener,noreferrer'); break
        case 'tab': { const l = currentLocation(); navigate(withQuery(l.pathname, l.search, { tab: step.tab }), true); break }
        case 'refresh': refresh(); break
        case 'request': {
          void request(step.method, step.path, step.body as Record<string, string> | undefined, host).catch((e: Error) => toast(e.message))
          break
        }
        default: break
      }
    },
    setQuery: (change) => { const l = currentLocation(); navigate(withQuery(l.pathname, l.search, change), true) },
    // A right click on a book's card opens its page, where its actions are.
    menu: (card) => { const id = card.node.props?.itemId; if (typeof id === 'string') navigate(`/book/${id}`) },
  }), [host, refresh, toast])

  // ---- adding files
  const add = useCallback(async (fileList: File[]) => {
    if (!fileList.length) return
    navigator.storage?.persist?.().catch(() => {}) // ask the browser not to clear the library when space runs low
    let last: string | null = null
    for (const f of fileList) {
      setBusy(`Adding ${f.name}…`)
      try { last = (await importFile(f)).key } catch (e) { toast((e as Error).message) }
    }
    setBusy('')
    refresh()
    if (last && fileList.length === 1) navigate(`/read/${last}`)
  }, [refresh, toast])
  const addRef = useRef(add)
  addRef.current = add

  useEffect(() => {
    const over = (e: DragEvent) => { if (e.dataTransfer?.types.includes('Files')) { e.preventDefault(); setDrag(true) } }
    const leave = (e: DragEvent) => { if (!e.relatedTarget) setDrag(false) }
    const drop = (e: DragEvent) => { e.preventDefault(); setDrag(false); if (!reading) addRef.current(Array.from(e.dataTransfer?.files || [])) }
    window.addEventListener('dragover', over); window.addEventListener('dragleave', leave); window.addEventListener('drop', drop)
    // Files opened with WittyReader from the system once it is installed, or by the desktop app.
    const fromSystem = (files: File[]) => { if (currentLocation().pathname.startsWith('/read/')) navigate('/', true); return addRef.current(files) }
    const lq = (window as unknown as { launchQueue?: { setConsumer?: (f: (p: { files: FileSystemFileHandle[] }) => void) => void } }).launchQueue
    lq?.setConsumer?.(async (p) => fromSystem(await Promise.all(p.files.map((h) => h.getFile()))))
    const desktop = (window as unknown as { wittyReaderDesktop?: { setBookConsumer?: (f: (o: { name: string; url?: string; error?: string }[]) => Promise<void>) => void } }).wittyReaderDesktop
    desktop?.setBookConsumer?.(async (opened) => {
      const files: File[] = []
      for (const o of opened) {
        try {
          if (o.error || !o.url) throw new Error(o.error)
          const res = await fetch(o.url)
          if (!res.ok) throw new Error()
          files.push(new File([await res.blob()], o.name))
        } catch (e) { toast((e as Error).message || `${o.name} could not be opened.`) }
      }
      await fromSystem(files)
    })
    const key = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o' && !currentLocation().pathname.startsWith('/read/')) { e.preventDefault(); picker.current?.click() } }
    window.addEventListener('keydown', key)
    return () => { window.removeEventListener('dragover', over); window.removeEventListener('dragleave', leave); window.removeEventListener('drop', drop); window.removeEventListener('keydown', key) }
  }, [reading, toast])

  const inputs = (
    <>
      <input ref={picker} type="file" accept={ACCEPT} multiple hidden onChange={(e) => { void add(Array.from(e.target.files || [])); e.target.value = '' }} />
      <input ref={notesPicker} type="file" accept=".json,application/json" hidden onChange={async (e) => {
        const f = e.target.files?.[0]; e.target.value = ''
        if (f) try { toast(await importNotesFile(f)); refresh() } catch (err) { toast((err as Error).message) }
      }} />
      <input ref={themePicker} type="file" accept=".zip,application/zip" hidden onChange={async (e) => {
        const f = e.target.files?.[0]; e.target.value = ''
        if (!f) return
        try {
          const t = readThemeZip(new Uint8Array(await f.arrayBuffer()), f.name)
          await addImported(t); await chooseTheme(t.meta.id); toast(`Theme “${t.meta.name}” added.`); refresh()
        } catch (err) { toast(err instanceof ThemeError ? err.message : 'That theme could not be added.') }
      }} />
    </>
  )
  const toastEl = msg && <div className="wr-toast" role="status">{msg}</div>

  if (reading) return <Reading bookKey={reading} toast={toast} dictionary={dictionary.current} toastEl={toastEl} />

  const back = () => navigate('/')
  return (
    <Shell navigation={navigation(device.formFactor, !!conn)} addBooks={() => picker.current?.click()}>
      {doc === undefined ? <div className="wr-wait"><div className="spinner" /></div>
        : doc === null || !route ? <div className="wr-gone"><h2>That page isn’t here</h2><p className="muted">A book may have been removed from this device.</p><button className="btn primary" onClick={back}>Back to your library</button></div>
          : <PageView doc={doc} device={device} handlers={handlers} />}
      {inputs}
      {drag && <div className="wr-drop" aria-hidden="true"><div><IconAdd size={40} />Drop to add to your library</div></div>}
      {busy && <div className="wr-busy" role="status"><div className="spinner" />{busy}</div>}
      {toastEl}
    </Shell>
  )
}

// The reading surface stays native: the plugins draw the book. Leaving the address closes it.
function Reading({ bookKey, toast, dictionary, toastEl }: { bookKey: string; toast: (m: string) => void; dictionary: boolean; toastEl: React.ReactNode }) {
  const [open, setOpen] = useState<{ host: ReaderHost; cleanup: () => void } | null>(null)
  const [gone, setGone] = useState(false)
  useEffect(() => {
    let live = true
    let opened: { host: ReaderHost; cleanup: () => void } | null = null
    ;(async () => {
      const rec = await books.get(bookKey)
      if (!rec) { setGone(true); return }
      try {
        opened = await openBook(rec, { toast, dictionary, close: () => (canGoBack() ? history.back() : navigate(`/book/${bookKey}`, true)) })
        if (live) setOpen(opened); else opened.cleanup()
      } catch (e) { toast((e as Error).message); navigate('/', true) }
    })()
    return () => { live = false; opened?.cleanup(); setOpen(null) }
  }, [bookKey, toast, dictionary])
  useEffect(() => { if (gone) { toast('That book is not on this device any more.'); navigate('/', true) } }, [gone, toast])
  if (!open) return <div className="reader center"><div className="spinner" /></div>
  const f = open.host.format
  return (
    <HostContext.Provider value={open.host}>
      {f === 'pdf' ? <Suspense fallback={<div className="reader center"><div className="spinner" /></div>}><WittyPDF /></Suspense> : f === 'cbz' ? <WittyComics /> : <WittyEbook />}
      {toastEl}
    </HostContext.Provider>
  )
}

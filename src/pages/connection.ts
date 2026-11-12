// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WittyWilla and contributors
import { ROUTES as SERVER_ROUTES, type RouteRule } from '../web/sdui/routes.ts'
import type { Document, Node } from '../web/sdui/types.ts'
import type { Connection } from './remote.ts'

// Connecting WittyReader to a WittyMediaServer, so its pages come from the server (remote.ts). The device is signed in by secure
// pairing (docs/CLIENT-API.md, "With a QR code and a PIN"): nothing typed but the server's address, no password in this app. The
// device shows a PIN and a QR code; someone signed in on another device approves it; the token comes back once.
export type Saved = Connection & { user?: string }
export type Pairing = { base: string; sessionId: string; deviceSecret: string; pin: string; approveUrl: string; intervalSec: number; expiresAt: number }
export type Poll = { status: 'pending' | 'approved' | 'denied' | 'expired' | 'locked' | 'slow-down'; token?: string; user?: string; pin?: string }
const KEY = 'wittyreader.servers'
const MAX_SERVERS = 8

/** The servers this device has added and is signed in to, the one in use last. */
export function savedServers(): Saved[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]')
    return Array.isArray(v) ? v.filter((s) => s && typeof s.token === 'string' && originOf(s.base) === s.base).slice(0, MAX_SERVERS) : []
  } catch { return [] }
}
const write = (list: Saved[]) => { try { localStorage.setItem(KEY, JSON.stringify(list)) } catch { /* this visit only */ } }
/** Adds (or replaces) a server and makes it the one in use. */
export function keep(s: Saved): Saved[] { const list = [...savedServers().filter((x) => x.base !== s.base), s].slice(-MAX_SERVERS); write(list); return list }
/** Takes a server away with its token. */
export function forget(base: string): Saved[] { const list = savedServers().filter((x) => x.base !== base); write(list); return list }
/** Makes a saved server the one in use. */
export function use(base: string): Saved[] { const all = savedServers(); const one = all.find((x) => x.base === base); const list = one ? [...all.filter((x) => x !== one), one] : all; write(list); return list }
export const inUse = (list: Saved[] = savedServers()): Saved | null => list[list.length - 1] || null

/** What the desktop app gives the page for the servers it lets the page call (desktop/preload.js). */
export type DesktopServers = { servers?: () => Promise<string[]>; addServer?: (address: string, hash?: string) => Promise<string | null>; removeServer?: (address: string) => Promise<boolean> }
export const desktop = (): DesktopServers | null => (typeof window !== 'undefined' ? ((window as unknown as { wittyReaderDesktop?: DesktopServers }).wittyReaderDesktop?.addServer ? (window as unknown as { wittyReaderDesktop: DesktopServers }).wittyReaderDesktop : null) : null)

/** An address as an origin ("http://192.168.1.20:9797"), or null: only http and https, a host and an optional port, no sign-in, no path,
 * query or fragment, no wildcard. The same rules as the desktop app's (desktop/origins.js; both are tested with desktop/test/origin-vectors.json). */
export function originOf(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const text = input.trim()
  if (!text || text.length > 200 || /[\s"'<>`\\*;,|]/.test(text)) return null
  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(text)
  if (!hasScheme && !/^(\[[0-9a-f:.]+\]|[a-z0-9.-]+)(:\d{1,5})?\/?$/i.test(text)) return null
  const withScheme = hasScheme ? text : 'http://' + text
  let u: URL
  try { u = new URL(withScheme) } catch { return null }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
  if (u.username || u.password || !u.hostname) return null
  if (u.search || u.hash || (u.pathname !== '/' && u.pathname !== '')) return null
  if (withScheme.includes('?') || withScheme.includes('#') || withScheme.includes('@')) return null
  if (u.hostname.includes('%') || u.hostname.startsWith('.') || u.hostname.endsWith('.')) return null
  return u.origin
}
export const serverBase = originOf

type Fetcher = typeof fetch
const json = async (res: Response) => { const t = await res.text(); try { return t ? JSON.parse(t) : {} } catch { return { error: t } } }

export async function startPairing(base: string, device: string, fetcher: Fetcher = fetch): Promise<Pairing> {
  let res: Response
  try { res = await fetcher(base + '/api/v1/auth/pair', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ device, platform: 'web' }) }) } catch { throw new Error("Can't reach that server. Check the address and that WittyMediaServer is running.") }
  const d = await json(res)
  if (!res.ok) throw new Error(d.error || (res.status === 404 ? 'That server does not offer secure pairing.' : 'The server would not start pairing.'))
  return { base, sessionId: d.sessionId, deviceSecret: d.deviceSecret, pin: d.pin, approveUrl: d.approveUrl, intervalSec: Math.max(2, Number(d.intervalSec) || 3), expiresAt: Number(d.expiresAt) || 0 }
}

/** One look at a pairing: whether it was approved (with the token), refused, or ran out, and the PIN to show now. */
export async function pollPairing(p: Pairing, fetcher: Fetcher = fetch): Promise<Poll> {
  const headers = { 'X-WMS-Pair-Secret': p.deviceSecret }
  const res = await fetcher(`${p.base}/api/v1/auth/pair/${encodeURIComponent(p.sessionId)}`, { headers })
  const d = await json(res)
  if (res.status === 403) return { status: 'denied' }
  if (res.status === 410) return { status: d.status === 'locked' ? 'locked' : 'expired' }
  if (res.status === 429) return { status: 'slow-down' }
  if (!res.ok) return { status: 'expired' }
  if (d.status === 'approved' && d.token) return { status: 'approved', token: d.token, user: d.user?.name }
  const pin = await fetcher(`${p.base}/api/v1/auth/pair/${encodeURIComponent(p.sessionId)}/pin`, { headers }).then(json).catch(() => ({}))
  return { status: 'pending', pin: pin.pin }
}

/** The server's own pages live under /s: its route table, each address and page prefixed. */
export const SERVER_RULES: RouteRule[] = SERVER_ROUTES.filter((r) => r.page).map((r) => ({ route: r.route === '/' ? '/s' : '/s' + r.route, page: 'server:' + r.page, params: r.params }))
const under = (to: string) => (to === '/' ? '/s' : SERVER_ROUTES.some((r) => !r.native && matches(r.route, to.split('?')[0])) ? '/s' + to : to)
const matches = (pattern: string, path: string) => { const a = pattern.split('/'), b = path.split('/'); return a.length === b.length && a.every((s, i) => (s.startsWith('{') && b[i] !== '') || s === b[i]) }

/** A page from the server with its addresses moved under /s, so a link inside it stays in the app's own routes. Links to the server's player and other native screens are left: they open nothing here. */
export function placed(doc: Document): Document {
  const walk = (x: Node): Node => {
    const out: Node = { ...x }
    if (x.action?.type === 'navigate' && x.action.to) out.action = { ...x.action, to: under(x.action.to) }
    if (x.props && (typeof x.props.seeAll === 'string' || typeof x.props.to === 'string')) {
      out.props = { ...x.props }
      if (typeof x.props.seeAll === 'string') out.props.seeAll = under(x.props.seeAll)
      if (typeof x.props.to === 'string') out.props.to = under(x.props.to)
    }
    if (x.children) out.children = x.children.map(walk)
    return out
  }
  return { ...doc, root: walk(doc.root) }
}

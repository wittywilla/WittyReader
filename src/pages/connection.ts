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
const KEY = 'wittyreader.server'

export const saved = (): Saved | null => { try { const v = JSON.parse(localStorage.getItem(KEY) || 'null'); return v?.base && v?.token ? v : null } catch { return null } }
export const keep = (s: Saved) => { try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* this visit only */ } }
export const forget = () => { try { localStorage.removeItem(KEY) } catch { /* nothing kept */ } }

/** The address a person typed as the server's base: http or https, no path, no sign-in in it. */
export function serverBase(input: string): string | null {
  const t = input.trim()
  if (!t) return null
  try {
    const u = new URL(/^[a-z]+:\/\//i.test(t) ? t : 'http://' + t)
    if (!/^https?:$/.test(u.protocol) || u.username || u.password) return null
    return u.origin
  } catch { return null }
}

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

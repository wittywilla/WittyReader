// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WittyWilla and contributors
import { query, type Device } from '../web/sdui/device.ts'
import { VERSION, type Document, type Navigation, type SectionItems } from '../web/sdui/types.ts'

// The remote page provider: when WittyReader is connected to a WittyMediaServer, its pages come from the server's
// SDUI routes (docs/SDUI.md, "HTTP API") instead of from the local provider (local.ts), as documents of the same shape,
// drawn by the same renderer. The server's pages are merged with the app's own (Notes, Import, Settings, the
// welcome page), which stay local, as a module's pages are merged into a server's navigation. Pairing a device with a
// server (the token) is the connection screen's job (CLIENT-API.md "Pairing"); this takes the address and token it made.
export type Connection = { base: string; token: string }
export class RemoteError extends Error {
  status: number
  constructor(status: number, message: string) { super(message); this.status = status }
}

const BASE = '/api/v1/sdui'
async function ask<T>(c: Connection, path: string, init: { method?: string; body?: unknown; etag?: string; fetcher?: typeof fetch } = {}): Promise<{ status: number; etag: string; data: T | null }> {
  const headers: Record<string, string> = { Authorization: 'Bearer ' + c.token }
  if (init.body !== undefined) headers['Content-Type'] = 'application/json'
  if (init.etag) headers['If-None-Match'] = init.etag
  let res: Response
  try { res = await (init.fetcher || fetch)(c.base.replace(/\/+$/, '') + path, { method: init.method || 'GET', headers, body: init.body === undefined ? undefined : JSON.stringify(init.body) }) } catch { throw new RemoteError(0, "Can't reach your server. Check that WittyMediaServer is running and that this device can reach it.") }
  if (res.status === 304) return { status: 304, etag: init.etag || '', data: null }
  const text = await res.text()
  let data: unknown = null
  try { data = text ? JSON.parse(text) : null } catch { data = { error: text } }
  if (!res.ok) throw new RemoteError(res.status, (data as { error?: string } | null)?.error || res.statusText)
  return { status: res.status, etag: res.headers.get('ETag') || '', data: data as T }
}

export function remote(c: Connection, fetcher?: typeof fetch) {
  const kept = new Map<string, { doc: Document; etag: string }>()
  return {
    /** A page as it is now, for this device; a page asked for again that has not changed is the one kept (If-None-Match). */
    async page(id: string, device: Device, params: Record<string, string> = {}): Promise<Document> {
      const path = `${BASE}/pages/${encodeURIComponent(id)}?${query(device, params)}`
      const had = kept.get(path)
      const r = await ask<Document>(c, path, { etag: had?.etag, fetcher })
      if (r.status === 304 && had) return had.doc
      if (!r.data || r.data.version !== VERSION) throw new RemoteError(502, 'This server sent a page this app cannot draw.')
      kept.set(path, { doc: r.data, etag: r.etag })
      return r.data
    },
    async navigation(device: Device): Promise<Navigation> {
      const r = await ask<Navigation>(c, `${BASE}/navigation?${query(device)}`, { fetcher })
      if (!r.data) throw new RemoteError(502, 'This server sent no menu.')
      return r.data
    },
    /** More of a section's items: the address comes from the page (props.more.url). */
    async items(url: string): Promise<SectionItems> {
      if (!url.startsWith(BASE + '/')) throw new RemoteError(400, 'An address that is not the server\'s SDUI.')
      const r = await ask<SectionItems>(c, url, { fetcher })
      if (!r.data) throw new RemoteError(502, 'This server sent no items.')
      return r.data
    },
    /** A command a page carries (watched, watch later...): the request `routes.plan` made of it. */
    async request(method: string, path: string, body?: unknown): Promise<void> {
      if (!path.startsWith('/')) throw new RemoteError(400, 'A path of the server.')
      await ask(c, '/api/v1' + path, { method, body, fetcher })
      kept.clear()
    },
  }
}

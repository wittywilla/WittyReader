// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WittyWilla and contributors
// The remote page provider against a stand-in server: what it asks for, with what, and what it refuses.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { remote, RemoteError } from '../../src/pages/remote.ts'

const device = { platform: 'desktop', formFactor: 'desktop', viewport: '1280x800', capabilities: ['keyboard'], locale: 'en', views: [] }
const doc = { version: 1, catalog: 8, page: { id: 'home', kind: 'home', title: 'Home' }, layout: {}, root: { type: 'Page', id: 'page' }, meta: {} }
const server = (answers) => { const log = []; const f = async (url, init) => { log.push({ url, init }); const a = answers(url, init); return new Response(a.body === undefined ? null : JSON.stringify(a.body), { status: a.status || 200, headers: a.headers || {} }) }; return { f, log } }

test('a page is asked for with the token and the device, and kept by its ETag', async () => {
  let n = 0
  const s = server((u, i) => (i.headers['If-None-Match'] === 'v1' ? { status: 304 } : (n++, { body: doc, headers: { ETag: 'v1' } })))
  const r = remote({ base: 'http://srv:9797/', token: 'tok' }, s.f)
  assert.equal((await r.page('home', device)).page.id, 'home')
  assert.match(s.log[0].url, /^http:\/\/srv:9797\/api\/v1\/sdui\/pages\/home\?catalog=\d+&platform=desktop&formFactor=desktop&viewport=1280x800/)
  assert.equal(s.log[0].init.headers.Authorization, 'Bearer tok')
  assert.equal((await r.page('home', device)).page.id, 'home')
  assert.equal(n, 1, 'the second ask got a 304')
})
test('a page of another version, an unreachable server and a server error are named', async () => {
  await assert.rejects(remote({ base: 'http://s', token: 't' }, server(() => ({ body: { ...doc, version: 9 } })).f).page('home', device), /cannot draw/)
  await assert.rejects(remote({ base: 'http://s', token: 't' }, async () => { throw new Error('down') }).page('home', device), (e) => e instanceof RemoteError && e.status === 0 && /Can't reach/.test(e.message))
  await assert.rejects(remote({ base: 'http://s', token: 't' }, server(() => ({ status: 404, body: { error: 'no such page' } })).f).page('x', device), /no such page/)
})
test('more items only from the SDUI routes, and a command clears what was kept', async () => {
  const s = server(() => ({ body: { version: 1, section: 's', items: [] } }))
  const r = remote({ base: 'http://s', token: 't' }, s.f)
  await assert.rejects(r.items('/api/v1/users'), /not the server/)
  assert.deepEqual((await r.items('/api/v1/sdui/pages/home/sections/s/items?cursor=2')).items, [])
  await r.request('POST', '/collections/watch-later/items', { items: [1] })
  assert.equal(s.log.at(-1).init.method, 'POST')
  assert.match(s.log.at(-1).url, /\/api\/v1\/collections\/watch-later\/items$/)
})

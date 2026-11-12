// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WittyWilla and contributors
// Connecting to a server by secure pairing, against a stand-in server; and moving a server page under /s.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { originOf, placed, pollPairing, SERVER_RULES, startPairing } from '../../src/pages/connection.ts'
import { resolve } from '../../src/web/sdui/routes.ts'

const reply = (status, body) => new Response(JSON.stringify(body), { status })
const vectors = JSON.parse(readFileSync(new URL('../../desktop/test/origin-vectors.json', import.meta.url), 'utf8'))
test('an address is turned into an origin, by the same rules as the desktop app', () => { for (const [input, want] of vectors.ok) assert.equal(originOf(input), want, input) })
test('anything that is not a plain http or https origin is refused', () => { for (const bad of vectors.bad) assert.equal(originOf(bad), null, JSON.stringify(bad)) })
test('pairing starts with the device name and polls with the secret; approval gives the token once', async () => {
  const log = []
  const f = async (url, init) => { log.push([url, init]); if (init?.method === 'POST') return reply(200, { sessionId: 's1', deviceSecret: 'sec', pin: '123456', approveUrl: 'http://srv/pair?code=ABC', intervalSec: 3, expiresAt: 99 }); return url.endsWith('/pin') ? reply(200, { pin: '654321' }) : reply(200, { status: log.length > 3 ? 'approved' : 'pending', token: 'T', user: { name: 'Alex' } }) }
  const p = await startPairing('http://srv', 'WittyReader', f)
  assert.deepEqual(JSON.parse(log[0][1].body), { device: 'WittyReader', platform: 'web' })
  assert.equal(p.pin, '123456')
  const a = await pollPairing(p, f)
  assert.deepEqual([a.status, a.pin], ['pending', '654321'])
  assert.equal(log[1][1].headers['X-WMS-Pair-Secret'], 'sec')
  const b = await pollPairing(p, f)
  assert.deepEqual([b.status, b.token, b.user], ['approved', 'T', 'Alex'])
})
test('refused, expired, locked and slow-down are told apart', async () => {
  const p = { base: 'http://s', sessionId: 'x', deviceSecret: 's', pin: '', approveUrl: '', intervalSec: 3, expiresAt: 0 }
  for (const [status, body, want] of [[403, {}, 'denied'], [410, { status: 'expired' }, 'expired'], [410, { status: 'locked' }, 'locked'], [429, {}, 'slow-down']]) assert.equal((await pollPairing(p, async () => reply(status, body))).status, want)
  await assert.rejects(startPairing('http://s', 'd', async () => { throw new Error('down') }), /Can't reach/)
  await assert.rejects(startPairing('http://s', 'd', async () => reply(404, {})), /does not offer secure pairing/)
})
test('a server page keeps its links inside the app, under /s', () => {
  assert.deepEqual(resolve('/s/library/3', '', SERVER_RULES), { kind: 'page', page: 'server:library', params: { library: '3' } })
  assert.equal(resolve('/s', '', SERVER_RULES).page, 'server:home')
  const doc = { version: 1, catalog: 8, page: { id: 'home', kind: 'home', title: 'H' }, layout: {}, meta: {}, root: { type: 'Page', id: 'p', children: [{ type: 'Shelf', id: 'a', props: { seeAll: '/library/3' }, children: [{ type: 'Card', id: 'c', action: { type: 'navigate', to: '/item/7' } }, { type: 'Card', id: 'd', action: { type: 'navigate', to: '/watch/7' } }] }] } }
  const out = placed(doc).root.children[0]
  assert.equal(out.props.seeAll, '/s/library/3')
  assert.deepEqual(out.children.map((c) => c.action.to), ['/s/item/7', '/watch/7'])
})

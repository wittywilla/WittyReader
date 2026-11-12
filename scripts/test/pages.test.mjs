// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WittyWilla and contributors
// The documents the local page provider makes: valid against the catalogue (the module kit's copy, revision 7),
// through the renderer's own layout step, and with the commands, routes and focus the renderer needs.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { layoutFor } from '../../src/pages/doc.ts'
import { COMMANDS, navigation, page, PAGES, registerCommands, ROUTES } from '../../src/pages/local.ts'
import { buildPage } from '../../src/web/sdui/model.ts'
import { plan, resolve } from '../../src/web/sdui/routes.ts'

const catalog = JSON.parse(readFileSync(new URL('../../src/web/catalog.json', import.meta.url), 'utf8'))
const comp = Object.fromEntries(catalog.components.map((c) => [c.type, c]))
const styles = new Set(catalog.cardStyles.map((s) => s.id || s.name || s.style || s))
const icons = new Set(catalog.icons.map((i) => i.id || i.name || i))
const kinds = new Set(catalog.pageKinds.map((k) => k.id || k.kind || k.name || k))

const book = (o) => ({ key: o.title, title: 'T', format: 'epub', total: 10, position: 0, added: 1, opened: 0, ...o })
const books = [book({ title: 'Alpha', author: 'Ann', format: 'pdf', position: 4, opened: 9 }), book({ title: 'Beta', author: 'Bo', added: 5 }), book({ title: 'Gamma', format: 'cbz', position: 9, opened: 3 })]
const notes = [{ id: 1, kind: 'highlight', chapter: 2, pos: 1, quote: 'A line', prefix: '', suffix: '', color: 'yellow', note: 'mine', created: 1, book: 'Alpha', bookTitle: 'Alpha', author: 'Ann' },
  { id: 2, kind: 'bookmark', chapter: 1, pos: 1, quote: '', prefix: '', suffix: '', color: '', note: '', created: 1, book: 'Beta', bookTitle: 'Beta' }]
const data = (o = {}) => ({ books, notes, hasCover: (k) => k === 'Alpha', dictionary: false, version: '0.3.0', used: '1.0 MB',
  looks: [{ id: 'lumen', name: 'Lumen', tagline: 'Quiet', description: 'The default.', theme: 'default', preview: { bg: '#0f1115', surface: '#1f232c', accent: '#7955ff' } }],
  themes: [{ id: 'default', name: 'Witty', description: 'House.', scheme: 'dark', preview: { bg: '#0f1115', surface: '#1f232c', text: '#e8eaf0', accent: '#7955ff' } }, { id: 'mine', name: 'Mine', description: 'Imported.', scheme: 'light', preview: {}, imported: true }],
  look: 'lumen', theme: 'look', ...o })

const RESOLVED = new Set(['Card', 'DetailHeader', 'FilterBar', 'SearchBox', 'ListItem', 'Banner', 'Grid', 'Shelf', 'NativeView'])
const walk = (n, f, parent) => { f(n, parent); for (const c of n.children || []) walk(c, f, n) }
const sizes = [[390, 844], [1280, 800]]
const cases = [['reader-library', ''], ['reader-library', 'q=zzz'], ['reader-library', 'kind=pdf&sort=title'], ['reader-book', 'item=Alpha'], ['reader-notes', ''], ['reader-notes', 'kind=highlight&withNote=1'], ['reader-import', ''], ['reader-settings', ''], ['reader-welcome', ''], ['reader-connect', '']]

for (const [id, q] of cases) for (const [w, h] of sizes) {
  test(`${id}${q ? '?' + q : ''} at ${w}: valid against the catalogue and drawable`, () => {
    const doc = page(id, new URLSearchParams(q), data(), layoutFor(w, h))
    assert.ok(doc, 'a document')
    assert.equal(doc.version, 1); assert.ok(doc.catalog >= catalog.revision, 'at least the kit\'s catalogue revision'); assert.ok(kinds.has(doc.page.kind), doc.page.kind)
    const ids = new Set(); let defaults = 0
    walk(doc.root, (n) => {
      assert.ok(!ids.has(n.id), `duplicate id ${n.id}`); ids.add(n.id)
      assert.match(n.id, /^[A-Za-z0-9_.:~-]{1,128}$/)
      const spec = comp[n.type]
      assert.ok(spec, `component ${n.type}`)
      const names = new Set(spec.props.map((p) => p.name))
      for (const [k, v] of Object.entries(n.props || {})) {
        // What the server resolves from its data (a card's, a header's, a filter bar's) isn't authored: those components carry more than the catalogue lists.
        const p = spec.props.find((x) => x.name === k)
        if (!RESOLVED.has(n.type)) assert.ok(names.has(k), `${n.type} has no property ${k}`)
        if (p?.options && typeof v === 'string' && n.type !== 'NativeView') assert.ok(p.options.some((o) => o.value === v), `${n.type}.${k}=${v}`)
        if (p?.maxLength && typeof v === 'string' && p.type !== 'markdown') assert.ok(v.length <= p.maxLength, `${n.type}.${k} is ${v.length} long`)
        if (p?.type === 'icon') assert.ok(icons.has(v), `icon ${v}`)
      }
      if (n.type === 'Card') assert.ok(styles.has(n.props.style), `card style ${n.props.style}`)
      for (const r of ['icon']) if (n.props?.[r]) assert.ok(icons.has(n.props[r]), `icon ${n.props[r]}`)
      for (const b of n.props?.actions || []) if (b.icon) assert.ok(icons.has(b.icon), `icon ${b.icon}`)
      if (n.focus?.default) defaults++
      if (n.action) assert.ok(['navigate', 'command', 'external', 'back', 'native'].includes(n.action.type))
    })
    assert.ok(defaults <= 1, 'at most one default focus')
    const model = buildPage(doc)
    assert.ok(model.root.children.length > 0)
  })
}

test('every action a page carries is one the app answers', () => {
  registerCommands()
  const ops = new Set(COMMANDS.map((c) => c.op))
  for (const [id, q] of cases) {
    walk(page(id, new URLSearchParams(q), data(), layoutFor(1280, 800)).root, (n) => {
      if (n.type === 'Form') return // its command is completed by Save, with the controls' values
      const acts = [n.action, ...(n.props?.actions || []).map((b) => b.action)].filter(Boolean)
      for (const a of acts) {
        const step = plan(a)
        assert.notEqual(step.do, 'nothing', `${id} ${n.id}: ${JSON.stringify(a)} does nothing`)
        if (a.type === 'command') { assert.ok(ops.has(a.op), a.op); assert.equal(step.do, 'request') }
        if (a.type === 'navigate') { const [path, query = ''] = a.to.split('?'); const r = resolve(path, query, ROUTES); assert.ok(r, `${a.to} resolves`) }
      }
    })
  }
})

test('routes open the pages, and /read opens the reading surface', () => {
  assert.deepEqual(resolve('/', '', ROUTES), { kind: 'page', page: 'reader-library', params: {} })
  assert.equal(resolve('/book/abc', '', ROUTES).params.item, 'abc')
  assert.deepEqual(resolve('/read/abc', '', ROUTES), { kind: 'native', screen: 'reader', vars: { item: 'abc' } })
  assert.equal(resolve('/nothing', '', ROUTES), null)
  for (const p of PAGES) assert.ok(page(p, new URLSearchParams('item=Alpha'), data(), layoutFor(1280, 800)), p)
})

test('a book that is not there has no page; an empty library offers to add books', () => {
  assert.equal(page('reader-book', new URLSearchParams('item=gone'), data(), layoutFor(1280, 800)), null)
  const empty = page('reader-library', new URLSearchParams(), data({ books: [], notes: [] }), layoutFor(1280, 800))
  assert.equal(empty.root.children[0].type, 'Banner')
  assert.equal(plan(empty.root.children[0].action).do, 'request')
})

test('the library shows continue reading, filters and the grid; a search with no hit says so', () => {
  const doc = page('reader-library', new URLSearchParams(), data(), layoutFor(1280, 800))
  assert.deepEqual(doc.root.children.map((c) => c.id), ['continue', 'filters', 'all'])
  assert.equal(doc.root.children[2].children.length, 3)
  const none = page('reader-library', new URLSearchParams('q=zzz'), data(), layoutFor(1280, 800))
  assert.equal(none.root.children.at(-1).type, 'Notice')
})

test('the navigation lists the four pages', () => {
  assert.deepEqual(navigation('web').items.map((i) => i.route), ['/', '/shelf', '/notes', '/import', '/settings'])
})

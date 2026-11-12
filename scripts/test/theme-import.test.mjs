// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WittyWilla and contributors
// Theme import, by the server's rules (WittyMediaServer docs/THEMES.md, "Limits").
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { strToU8, zipSync } from 'fflate'
import { readThemeZip, reachesOutside, variablesOnly } from '../../src/theme/importTheme.ts'

const json = (o) => strToU8(JSON.stringify(o))
const make = (files) => zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, typeof v === 'string' ? strToU8(v) : v])))
const good = { 'theme.json': json({ id: 'mine', name: 'Mine', scheme: 'light' }), 'theme.css': ':root { color-scheme: light; --bg: #fff; --accent: #d4a017; }' }
const refused = (files, re, name) => assert.throws(() => readThemeZip(make(files), name), re)

test('a minimal theme is accepted, with its id, scheme and css', () => {
  const t = readThemeZip(make(good))
  assert.equal(t.meta.id, 'mine'); assert.equal(t.meta.scheme, 'light'); assert.match(t.css, /--accent/)
})
test('the id can come from the file name, and a built-in id is taken', () => {
  assert.equal(readThemeZip(make({ ...good, 'theme.json': json({ name: 'N' }) }), 'Cool Theme.zip').meta.id, 'cool-theme')
  refused({ ...good, 'theme.json': json({ id: 'midnight', name: 'M' }) }, /ships with the app/)
})
test('builtin, a missing name and missing files are refused', () => {
  refused({ ...good, 'theme.json': json({ id: 'x', name: 'X', builtin: true }) }, /builtin/)
  refused({ ...good, 'theme.json': json({ id: 'x' }) }, /needs a "name"/)
  refused({ 'theme.json': good['theme.json'] }, /theme.css is missing/)
  refused({ 'theme.css': good['theme.css'] }, /theme.json is missing/)
})
test('css may hold variables and @font-face only', () => {
  assert.equal(variablesOnly(':root{--a:1} @font-face{font-family:X;src:url("f.woff2")}'), '')
  assert.match(variablesOnly('.btn { color: red }'), /rule not allowed/)
  assert.match(variablesOnly(':root { background: red }'), /variables only/)
  assert.match(variablesOnly('@media (x) { :root { --a: 1 } }'), /not allowed/)
  refused({ ...good, 'theme.css': 'body { color: red }' }, /not allowed in a theme/)
  refused({ ...good, 'extra.css': ':root{}' }, /one stylesheet/)
})
test('nothing may reach another site, however it is written', () => {
  for (const css of [':root{--x:url(https://a.b/c)}', ':root{--x:url(//a.b/c)}', ':root{--x:url("ht\\74 tp://a.b")}', '/* http://a.b */:root{}']) assert.ok(reachesOutside(css), css)
  assert.ok(!reachesOutside(':root{--x:url(data:image/svg+xml;base64,AAAA//==)}'.replace('AAAA//==', 'AAAA')))
  refused({ ...good, 'theme.css': ':root{--x:url(https://evil.example/x.png)}' }, /another site/)
})
test('file names and types are checked', () => {
  refused({ ...good, 'a/../../b.png': new Uint8Array(3) }, /unsafe file name/)
  refused({ ...good, 'run.exe': new Uint8Array(3) }, /not allowed in a theme/)
  refused({ ...good, 'noext': new Uint8Array(3) }, /not allowed in a theme/)
  assert.ok(readThemeZip(make({ ...good, 'assets/fonts/F.woff2': new Uint8Array(8) })).assets['assets/fonts/F.woff2'])
  assert.throws(() => readThemeZip(new Uint8Array([1, 2, 3])), /not a ZIP/)
})
test('a finish keeps only real colours', () => {
  const t = readThemeZip(make({ ...good, 'theme.json': json({ id: 'f', name: 'F', finish: { glass: { hi: 'rgba(1,2,3,.4)', lo: 'url(x)' }, gloss: ['#fff', 'expression(1)'] } }) }))
  assert.deepEqual(t.meta.finish, { glass: { hi: 'rgba(1,2,3,.4)' }, gloss: ['#fff'] })
})

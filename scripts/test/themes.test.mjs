// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WittyWilla and contributors
// The 15 themes and 14 looks copied from WittyMediaServer: whole, and their text readable on them.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const read = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8')
const { themes } = JSON.parse(read('public/themes/index.json'))
const { experiences } = JSON.parse(read('src/web/experiences.json'))
const vars = (css) => Object.fromEntries([...css.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]))
const hex = (s) => (/^#[0-9a-f]{6}$/i.test(s) ? s : '')
const lum = (h) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }

test('there are fifteen themes, the default first, with a light one, and fourteen looks', () => {
  assert.equal(themes.length, 15)
  assert.equal(themes[0].id, 'default')
  assert.ok(themes.some((t) => t.scheme === 'light'))
  assert.equal(new Set(themes.map((t) => t.id)).size, 15)
  assert.equal(experiences.length, 14)
})
test('every look names a theme that ships', () => {
  for (const e of experiences) assert.ok(themes.some((t) => t.id === e.theme), `${e.id} wears ${e.theme}`)
})
test('every theme has its files, its colours and readable text', () => {
  for (const t of themes) {
    const meta = JSON.parse(read(`public/themes/${t.id}/theme.json`))
    assert.equal(meta.id, t.id)
    const v = vars(read(`public/themes/${t.id}/theme.css`))
    for (const k of ['--bg', '--bg-2', '--bg-3', '--fg', '--fg-2', '--accent', '--accent-fg', '--accent-text']) assert.ok(v[k], `${t.id} sets ${k}`)
    for (const [fg, bg, need] of [['--fg', '--bg', 4.5], ['--fg-2', '--bg-2', 4.5], ['--accent-fg', '--accent', 4.5], ['--accent-text', '--bg-3', 4.5]]) {
      if (hex(v[fg]) && hex(v[bg])) assert.ok(contrast(v[fg], v[bg]) >= need, `${t.id}: ${fg} on ${bg} is ${contrast(v[fg], v[bg]).toFixed(2)}`)
    }
  }
})

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WittyWilla and contributors
// The themes copied from WittyMediaServer: each is whole, and its text is readable on it.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const { themes } = JSON.parse(readFileSync(new URL('../../src/themes.json', import.meta.url), 'utf8'))
const NEEDED = ['--bg', '--bg-2', '--bg-3', '--bg-4', '--fg', '--fg-2', '--fg-3', '--accent', '--accent-2', '--accent-fg', '--accent-text', '--danger', '--border']

function rgb(hex) {
  let h = hex.slice(1)
  if (h.length <= 4) h = [...h].map((c) => c + c).join('')
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
}
const lum = (hex) => {
  const [r, g, b] = rgb(hex).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }

test('the default dark theme comes first, and there is a light one for "Match this device"', () => {
  assert.equal(themes[0].id, 'default')
  assert.equal(themes[0].scheme, 'dark')
  assert.ok(themes.some((t) => t.scheme === 'light'))
  assert.equal(new Set(themes.map((t) => t.id)).size, themes.length)
})

test('every theme has every colour the library and the readers use', () => {
  for (const t of themes) {
    for (const v of NEEDED) assert.match(t.colors[v] || '', /^#[0-9a-fA-F]{3,8}$/, `${t.id} ${v}`)
    // The desktop window takes only #rrggbb behind the page.
    assert.match(t.colors['--bg'], /^#[0-9a-fA-F]{6}$/, `${t.id} --bg`)
  }
})

test('text is readable on every surface of every theme', () => {
  for (const t of themes) {
    for (const bg of ['--bg', '--bg-2', '--bg-3']) {
      assert.ok(contrast(t.colors['--fg'], t.colors[bg]) >= 4.5, `${t.id}: --fg on ${bg}`)
      assert.ok(contrast(t.colors['--fg-2'], t.colors[bg]) >= 4.5, `${t.id}: --fg-2 on ${bg}`)
    }
    assert.ok(contrast(t.colors['--accent-fg'], t.colors['--accent']) >= 4.5, `${t.id}: button text`)
  }
})

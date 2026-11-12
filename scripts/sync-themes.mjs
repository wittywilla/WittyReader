#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WittyWilla and contributors
// Copies the colours of WittyMediaServer's built-in themes into src/themes.json, so
// WittyReader offers the same looks as the server and its apps. Only the colour values
// and names are taken; nothing else from the server is used.
//
//   node scripts/sync-themes.mjs [path to a WittyMediaServer checkout]
//
// It defaults to a checkout beside this one. Run it when the server's themes change, and
// commit what it writes: the app never needs the server to build.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const server = resolve(process.argv[2] || join(here, '../../WittyMediaServer'))
const dir = join(server, 'themes')
if (!existsSync(dir)) throw new Error(`no themes folder in ${server}`)

// The server's names for its colours, and the CSS variables the readers use for them.
const vars = {
  bg: '--bg', bg2: '--bg-2', bg3: '--bg-3', bg4: '--bg-4',
  fg: '--fg', fg2: '--fg-2', fg3: '--fg-3',
  accent: '--accent', accentHover: '--accent-2', accentFg: '--accent-fg', accentText: '--accent-text',
  danger: '--danger', ok: '--ok', warn: '--warn', border: '--border', focus: '--focus',
}
// The default first, then light ones, then the other dark ones, each by name.
const themes = readdirSync(dir).filter((d) => existsSync(join(dir, d, 'theme.json')))
  .map((d) => JSON.parse(readFileSync(join(dir, d, 'theme.json'), 'utf8')))
  .filter((t) => t.builtin && t.colors && /^[a-z0-9-]+$/.test(t.id))
  .map((t) => ({
    id: t.id, name: t.name, description: t.description || '', scheme: t.scheme === 'light' ? 'light' : 'dark',
    colors: Object.fromEntries(Object.entries(vars).filter(([k]) => typeof t.colors[k] === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(t.colors[k])).map(([k, v]) => [v, t.colors[k]])),
  }))
  .sort((a, b) => (a.id === 'default' ? -1 : b.id === 'default' ? 1 : a.scheme !== b.scheme ? (a.scheme === 'light' ? -1 : 1) : a.name.localeCompare(b.name)))
if (!themes.some((t) => t.id === 'default') || !themes.some((t) => t.scheme === 'light')) throw new Error('expected the server\'s default theme and at least one light theme')
const out = join(here, '../src/themes.json')
writeFileSync(out, JSON.stringify({ $comment: 'Written by scripts/sync-themes.mjs from WittyMediaServer\'s built-in themes. Do not edit by hand.', themes }, null, 2) + '\n')
console.log(`${themes.length} themes written to ${out}`)

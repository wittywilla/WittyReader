#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WittyWilla and contributors
// Puts the reader plugins from checkouts on this machine into node_modules, in place of
// the released ones `npm ci` fetched, so WittyReader can be built and tried with plugin
// changes that aren't released yet. package.json and package-lock.json are not touched;
// `npm ci` brings back the released ones.
//
//   node scripts/dev-modules.mjs [folder holding WittyInk, WittyEbook, WittyPDF, WittyComics]
//
// The folder defaults to the one this checkout is in. Each plugin can also be named on its
// own: WITTYINK_DIR, WITTYEBOOK_DIR, WITTYPDF_DIR, WITTYCOMICS_DIR. The files are copied,
// not linked, because a link would make the bundler look for React beside the plugin.
import { cpSync, existsSync, readFileSync, realpathSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const beside = resolve(process.argv[2] || join(root, '..'))
const plugins = { wittyink: 'WittyInk', wittyebook: 'WittyEbook', wittypdf: 'WittyPDF', wittycomics: 'WittyComics' }

if (!existsSync(join(root, 'node_modules', '@wittywilla'))) throw new Error('run npm ci first')
for (const [id, repo] of Object.entries(plugins)) {
  const named = resolve(process.env[`${id.toUpperCase()}_DIR`] || join(beside, repo))
  const from = existsSync(named) ? realpathSync(named) : named
  const manifest = join(from, 'module.json')
  if (!existsSync(manifest)) { console.log(`${repo}: no checkout at ${from}, keeping the released one`); continue }
  const { id: got, version } = JSON.parse(readFileSync(manifest, 'utf8'))
  if (got !== id) throw new Error(`${from} holds ${got}, not ${id}`)
  const to = join(root, 'node_modules', '@wittywilla', id)
  rmSync(to, { recursive: true, force: true })
  cpSync(from, to, { recursive: true, filter: (src) => !/[\\/](\.git|node_modules|dist|\.claude)$/.test(src) })
  console.log(`${repo} ${version} from ${from}`)
}

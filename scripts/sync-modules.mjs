#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WittyWilla and contributors
// Copies the reader modules' settings (the "settings" of each module's sdui.json: WittyInk, WittyEbook, WittyPDF, WittyComics) into
// src/modules/settings.json. Those keys and value forms are the contract every app shares: a profile's choice of "textSize" means
// the same in the server's Reader page and here, and the readers ask the host for them as `ReaderHost.settings`.
//
//   node scripts/sync-modules.mjs [folder holding WittyInk, WittyEbook, WittyPDF, WittyComics]
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const beside = resolve(process.argv[2] || [join(root, '..'), join(root, '../..')].find((d) => existsSync(join(d, 'WittyInk/sdui.json'))) || join(root, '..'))
const out = {}
for (const [repo, id] of [['WittyEbook', 'wittyebook'], ['WittyPDF', 'wittypdf'], ['WittyComics', 'wittycomics'], ['WittyInk', 'wittyink']]) {
  const file = join(beside, repo, 'sdui.json')
  if (!existsSync(file)) throw new Error(`no ${file}`)
  const page = JSON.parse(readFileSync(file, 'utf8')).settings.find((p) => p.id === id)
  if (!page) throw new Error(`${repo} has no settings page ${id}`)
  out[id] = page
}
writeFileSync(join(root, 'src/modules/settings.json'), JSON.stringify({ $comment: 'Written by scripts/sync-modules.mjs from the reader modules\' sdui.json. Do not edit by hand.', modules: out }, null, 2) + '\n')
console.log(`settings of ${Object.keys(out).length} modules from ${beside}`)

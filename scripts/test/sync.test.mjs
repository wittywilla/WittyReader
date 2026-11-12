// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WittyWilla and contributors
// The files copied from WittyMediaServer are exactly what scripts/sync-web.mjs wrote, and (with a server checkout
// beside this one) what the server has now. Edit the server's, then run the script: never the copy.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { WEB } from '../sync-web.mjs'

const root = fileURLToPath(new URL('../../', import.meta.url))
const sync = JSON.parse(readFileSync(root + 'src/web/SYNC.json', 'utf8'))
const sha = (b) => createHash('sha256').update(b).digest('hex')

test('every copied file is listed, and is the file that was written', () => {
  for (const f of WEB) assert.ok(sync.files['src/web/' + f], `${f} is in SYNC.json`)
  for (const [f, hash] of Object.entries(sync.files)) assert.equal(sha(readFileSync(root + f)), hash, `${f} was edited by hand: change the server's file and run scripts/sync-web.mjs`)
})
test('the copies are the server\'s files now', (t) => {
  const server = [root + '../WittyMediaServer', root + '../../WittyMediaServer'].find((d) => existsSync(d + '/web/src/sdui/model.ts'))
  if (!server) return t.skip('no WittyMediaServer checkout beside this one')
  for (const f of WEB) assert.equal(sha(readFileSync(root + 'src/web/' + f)), sha(readFileSync(server + '/web/src/' + f)), `${f} differs from the server's: run scripts/sync-web.mjs`)
})

#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WittyWilla and contributors
// Copies the pieces of WittyMediaServer's web app that draw a server-driven page (the SDUI
// renderer, the design system's stylesheets, the 15 themes and the catalogue) into this
// repository, unchanged, so that WittyReader draws its own screens with the server's own
// renderer and wears its themes without a fork. See docs/SDUI-ARCHITECTURE.md.
//
//   node scripts/sync-web.mjs [path to a WittyMediaServer checkout] [path to a WittyModule checkout]
//
// Defaults to checkouts beside this one. Run it when the server's renderer or themes change
// and commit what it writes: the app never needs the server to build. Nothing under
// src/web/ that is listed in src/web/SYNC.json is edited by hand; `npm test` fails when one
// differs from its recorded hash, and (when a server checkout is beside it) from the server's.
// The files in src/web/ that are NOT listed are the app's own seams, which the synced files
// import from where the server has its api, state and icons.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
// A checkout beside this one, or beside the .worktrees folder this one may be in.
const beside = (name) => [join(root, '..', name), join(root, '../../', name)].find((d) => existsSync(d)) || join(root, '..', name)
const server = resolve(process.argv[2] || beside('WittyMediaServer'))
const module_ = resolve(process.argv[3] || beside('WittyModule'))

// Files of web/src copied to src/web/ (same relative path), by the renderer's own imports.
export const WEB = [
  'brandName.ts', 'brandStyle.ts', 'icons.tsx', 'ui/avatarColor.ts', 'libraryNouns.ts', 'safeLink.ts', 'themeOverrides.ts',
  'sdui/cardStyles.ts', 'sdui/device.ts', 'sdui/extras/episodeView.ts', 'sdui/focus.ts', 'sdui/gridView.ts',
  'sdui/markdownModel.ts', 'sdui/model.ts', 'sdui/native.ts', 'sdui/patch.ts', 'sdui/playModel.ts', 'sdui/routes.ts', 'sdui/types.ts',
  'sdui/render/DockView.tsx', 'sdui/render/components.tsx', 'sdui/render/context.tsx', 'sdui/render/icons.tsx', 'sdui/render/markdown.tsx', 'sdui/render/widgets.tsx',
  'ui/Button.tsx', 'ui/Choice.tsx', 'ui/Dock.tsx', 'ui/Field.tsx', 'ui/KeyLegend.tsx', 'ui/Menu.tsx', 'ui/Overlay.tsx', 'ui/Scene.tsx', 'ui/Tooltip.tsx',
  'ui/backEntry.ts', 'ui/themeMaker.ts', 'ui/inputKind.ts', 'ui/inputModel.ts', 'ui/menuPlace.ts', 'ui/spatial.ts', 'ui/useInput.ts',
  // the design system's stylesheets
  'styles.css', 'design2.css', 'finish.css', 'ui/ui.css', 'sdui/sdui.css',
]
// The bundled type sets (SIL OFL) the themes' `type` names.
const FONTS = 'public/fonts'

const sha = (b) => createHash('sha256').update(b).digest('hex')
const git = (cwd, ...a) => { try { return execFileSync('git', ['-C', cwd, ...a], { encoding: 'utf8' }).trim() } catch { return '' } }

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (!existsSync(join(server, 'web/src/sdui/model.ts'))) throw new Error(`no web app in ${server}`)
  const out = join(root, 'src/web')
  const hashes = {}
  for (const f of WEB) {
    const from = join(server, 'web/src', f)
    const buf = readFileSync(from)
    const to = join(out, f)
    mkdirSync(dirname(to), { recursive: true })
    writeFileSync(to, buf)
    hashes['src/web/' + f] = sha(buf)
  }
  // The 15 built-in themes: theme.json and theme.css, served from public/themes/<id>/ and listed in themes/index.json.
  const themesDir = join(server, 'themes')
  const ids = readdirSync(themesDir).filter((d) => existsSync(join(themesDir, d, 'theme.json')))
  const index = []
  rmSync(join(root, 'public/themes'), { recursive: true, force: true })
  for (const id of ids) {
    const meta = JSON.parse(readFileSync(join(themesDir, id, 'theme.json'), 'utf8'))
    if (!meta.builtin) continue
    for (const f of ['theme.json', 'theme.css']) {
      const buf = readFileSync(join(themesDir, id, f))
      mkdirSync(join(root, 'public/themes', id), { recursive: true })
      writeFileSync(join(root, 'public/themes', id, f), buf)
      hashes[`public/themes/${id}/${f}`] = sha(buf)
    }
    index.push({ id, name: meta.name, description: meta.description || '', scheme: meta.scheme, preview: meta.preview || {}, experienceOf: undefined })
  }
  index.sort((a, b) => (a.id === 'default' ? -1 : b.id === 'default' ? 1 : a.scheme !== b.scheme ? (a.scheme === 'light' ? -1 : 1) : a.name.localeCompare(b.name)))
  if (index.length !== 15) throw new Error(`expected 15 built-in themes, found ${index.length}`)
  writeFileSync(join(root, 'public/themes/index.json'), JSON.stringify({ themes: index.map(({ experienceOf, ...t }) => t) }, null, 2) + '\n')
  // The design tokens (generated from the server's CSS) and the experiences' finish, so an app can wear them as data.
  const tokens = readFileSync(join(server, 'themes/tokens.json'))
  writeFileSync(join(root, 'src/web/tokens.json'), tokens); hashes['src/web/tokens.json'] = sha(tokens)
  // The fourteen experiences (looks), in one file: their finish, shape, type, density and default theme.
  const exDir = join(server, 'pkg/sdui/experiences')
  const exs = readdirSync(exDir).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(join(exDir, f), 'utf8'))).sort((a, b) => a.order - b.order)
  const exBuf = Buffer.from(JSON.stringify({ $comment: 'Written by scripts/sync-web.mjs from WittyMediaServer pkg/sdui/experiences.', experiences: exs }, null, 2) + '\n')
  writeFileSync(join(root, 'src/web/experiences.json'), exBuf); hashes['src/web/experiences.json'] = sha(exBuf)
  // The device profiles the server fits a page to, as its own conformance fixtures carry them: a phone, a tablet, the web and the desktop.
  const fx = join(server, 'pkg/sdui/conformance/fixtures')
  const wanted = { phone: 'backdrops-iphone.json', tablet: 'home-kids-variant.json', web: 'module-page-web.json', desktop: 'exp-dashboard-desktop.json' }
  const layouts = Object.fromEntries(Object.entries(wanted).map(([k, f]) => [k, JSON.parse(readFileSync(join(fx, f), 'utf8')).expected.document.layout]))
  const layBuf = Buffer.from(JSON.stringify({ $comment: 'Written by scripts/sync-web.mjs from the server conformance fixtures: the device profiles a page is fitted to.', layouts }, null, 2) + '\n')
  writeFileSync(join(root, 'src/web/layouts.json'), layBuf); hashes['src/web/layouts.json'] = sha(layBuf)
  // The catalogue the page builders and the tests check against (the module kit's copy).
  const cat = readFileSync(join(module_, 'kit/sdui/catalog.json'))
  writeFileSync(join(root, 'src/web/catalog.json'), cat); hashes['src/web/catalog.json'] = sha(cat)
  const fonts = join(server, 'web/public/fonts')
  if (existsSync(fonts)) { rmSync(join(root, FONTS), { recursive: true, force: true }); cpSync(fonts, join(root, FONTS), { recursive: true }) }
  writeFileSync(join(out, 'SYNC.json'), JSON.stringify({
    $comment: 'Written by scripts/sync-web.mjs. The hash of every file copied from WittyMediaServer and WittyModule; do not edit by hand.',
    server: git(server, 'rev-parse', '--short', 'HEAD'), serverBranch: git(server, 'rev-parse', '--abbrev-ref', 'HEAD'), module: git(module_, 'rev-parse', '--short', 'HEAD'),
    files: hashes,
  }, null, 2) + '\n')
  console.log(`${WEB.length} web files, ${index.length} themes and the catalogue copied from ${server}`)
}

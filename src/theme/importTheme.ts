// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WittyWilla and contributors
import { strFromU8, unzipSync } from 'fflate'

// Theme import, by the server's rules (WittyMediaServer docs/THEMES.md, "Limits"; internal/themes
// parseTheme): a ZIP with theme.json and theme.css at its top level, plain relative file names,
// a short list of file types, theme.css holding variables and @font-face only, and nothing that
// could reach another site. Pure, so it is tested without a browser.

export const MAX_ZIP = 25 << 20
export const MAX_FILE = 10 << 20
export const MAX_FILES = 200
export const MAX_CSS = 2 << 20
export const TYPES: Record<string, string> = {
  css: 'text/css', json: 'application/json', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif',
  svg: 'image/svg+xml', woff2: 'font/woff2', woff: 'font/woff', ttf: 'font/ttf', otf: 'font/otf', txt: 'text/plain', md: 'text/markdown',
}
const ID = /^[A-Za-z0-9._-]{1,64}$/
export const BUILTIN_IDS = ['default', 'midnight', 'cinema', 'evergreen', 'oled', 'light', 'paper', 'contrast', 'aeroday', 'aeroaurora', 'aeromeadow', 'aerosunset', 'cable', 'satellite', 'teletext']

export type ThemeMeta = { id: string; name: string; description?: string; author?: string; version?: string; scheme: 'dark' | 'light'; builtin?: boolean
  preview?: { bg?: string; surface?: string; text?: string; accent?: string }; finish?: { glass?: Record<string, string>; gloss?: string[] }; scene?: { layers?: unknown[] } }
export type ImportedTheme = { meta: ThemeMeta; css: string; assets: Record<string, Uint8Array> }
export class ThemeError extends Error {}

/** Undoes CSS escapes and what a browser drops from an address, so a hidden `http:` is found. */
export function unescapeCss(css: string): string {
  return css
    .replace(/\\([0-9a-fA-F]{1,6})[ \t\r\n\f]?/g, (_, h: string) => { const n = parseInt(h, 16); return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : '' })
    .replace(/\\(.)/gs, '$1')
    .replace(/[\t\n\r\f]/g, '')
}

/** Whether a stylesheet names an address on another site (the server's `outsideURL`). */
export function reachesOutside(css: string): boolean {
  let t = unescapeCss(css).toLowerCase()
  t = t.replace(/;base64,[a-z0-9+/=]+/g, '').replaceAll('http://www.w3.org/', '').replaceAll('*//*', '')
  return ['http:', 'https:', '//', '/\\', '\\/', '\\\\'].some((m) => t.includes(m))
}

/** theme.css is `:root` rules of variables and `@font-face` blocks, and nothing else. Returns the problem, or ''. */
export function variablesOnly(css: string): string {
  const t = css.replace(/\/\*[\s\S]*?\*\//g, '')
  let i = 0
  while (i < t.length) {
    const open = t.indexOf('{', i)
    if (open < 0) return t.slice(i).trim() ? `stray text: ${t.slice(i).trim().slice(0, 40)}` : ''
    const head = t.slice(i, open).trim()
    const close = t.indexOf('}', open)
    if (close < 0) return `unclosed rule: ${head}`
    if (head !== ':root' && head !== '@font-face') return `rule not allowed in a theme: ${head.slice(0, 60)}`
    if (t.slice(open + 1, close).includes('{')) return `nested rule in ${head}`
    for (const decl of t.slice(open + 1, close).split(';')) {
      const d = decl.trim()
      if (!d) continue
      const name = d.slice(0, d.indexOf(':')).trim()
      if (head === ':root' && !/^(--[\w-]+|color-scheme)$/.test(name)) return `:root may set variables only, not ${name || d.slice(0, 30)}`
      if (head === '@font-face' && !/^(font-family|src|font-weight|font-style|font-display|unicode-range|font-stretch)$/.test(name)) return `@font-face may not set ${name}`
    }
    i = close + 1
  }
  return ''
}

const colourOK = (v: unknown) => typeof v === 'string' && /^(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\))$/.test(v.trim())

/** Checks a theme ZIP and reads it. `fileName` gives the id when theme.json has none. */
export function readThemeZip(data: Uint8Array, fileName = ''): ImportedTheme {
  if (data.length > MAX_ZIP) throw new ThemeError(`theme ZIP is larger than ${MAX_ZIP >> 20} MB`)
  let files: Record<string, Uint8Array>
  try { files = unzipSync(data, { filter: (f) => { if (f.originalSize > MAX_FILE) throw new ThemeError(`${f.name} is larger than ${MAX_FILE >> 20} MB`); return !f.name.endsWith('/') } }) } catch (e) {
    if (e instanceof ThemeError) throw e
    throw new ThemeError('not a ZIP file: themes must be packed as .zip')
  }
  const names = Object.keys(files)
  if (names.length > MAX_FILES) throw new ThemeError(`theme has more than ${MAX_FILES} files`)
  let cssLeft = MAX_CSS
  for (const name of names) {
    const clean = name.split('/').reduce<string[]>((a, p) => (p === '..' ? a.slice(0, -1) : p === '.' || p === '' ? a : [...a, p]), []).join('/')
    if (clean !== name || name.includes('\\') || name.startsWith('/')) throw new ThemeError(`unsafe file name in ZIP: "${name}"`)
    const ext = name.slice(name.lastIndexOf('.') + 1).toLowerCase()
    if (!name.includes('.') || !TYPES[ext]) throw new ThemeError(`file type not allowed in a theme: ${name} (allowed: css, json, images, fonts, txt, md)`)
    if (ext === 'css') {
      const css = strFromU8(files[name])
      if ((cssLeft -= css.length) < 0) throw new ThemeError('the stylesheets in this theme are too large')
      if (reachesOutside(css)) throw new ThemeError(`${name} names an address on another site: a theme uses its own files only`)
      if (name !== 'theme.css') throw new ThemeError(`${name}: a theme has one stylesheet, theme.css, and it holds variables only`)
      const bad = variablesOnly(css)
      if (bad) throw new ThemeError(`${name}: ${bad}`)
    }
  }
  if (!files['theme.json']) throw new ThemeError('theme.json is missing from the top level of the ZIP')
  if (!files['theme.css']) throw new ThemeError('theme.css is missing from the top level of the ZIP')
  let meta: ThemeMeta
  try { meta = JSON.parse(strFromU8(files['theme.json'])) } catch (e) { throw new ThemeError(`theme.json: ${(e as Error).message}`) }
  if (!meta || typeof meta !== 'object' || typeof meta.name !== 'string' || !meta.name.trim()) throw new ThemeError('theme.json needs a "name"')
  if (meta.builtin) throw new ThemeError('remove "builtin": true from theme.json (it is reserved for the themes that ship with the app)')
  if (meta.scheme !== 'light') meta.scheme = 'dark'
  // Colours in a finish are accepted only as #hex, rgb(), rgba(), hsl() or hsla(); anything else is dropped.
  if (meta.finish) {
    const g = meta.finish.glass && Object.fromEntries(Object.entries(meta.finish.glass).filter(([, v]) => colourOK(v)))
    meta.finish = { ...(g ? { glass: g } : {}), ...(Array.isArray(meta.finish.gloss) ? { gloss: meta.finish.gloss.filter(colourOK).slice(0, 5) } : {}) }
  }
  let id = String(meta.id || fileName.replace(/\.zip$/i, '')).toLowerCase().replace(/[^a-z0-9._-]+/g, '-')
  if (!ID.test(id) || id.startsWith('.')) throw new ThemeError('choose a theme id (theme.json "id") of letters, digits, dots, dashes or underscores')
  if (BUILTIN_IDS.includes(id)) throw new ThemeError(`"${id}" is the id of a theme that ships with the app: give yours a new one`)
  meta.id = id
  const assets: Record<string, Uint8Array> = {}
  for (const n of names) if (n !== 'theme.json' && n !== 'theme.css') assets[n] = files[n]
  return { meta, css: strFromU8(files['theme.css']), assets }
}

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WittyWilla and contributors
// Pictures of a standalone app have no server address. A page's cards name them as
// `/api/local/...` (the renderer takes only /api/ paths); this answers each with a URL the
// browser can draw: a cover kept on the device as an object URL, or a drawn swatch of a theme.

const covers = new Map<string, string>()

/** Registers (or replaces) the cover of a book, and returns its page address. */
export function registerCover(key: string, blob: Blob): string {
  const old = covers.get(key)
  if (old) URL.revokeObjectURL(old)
  covers.set(key, URL.createObjectURL(blob))
  return coverPath(key)
}
export const coverPath = (key: string) => `/api/local/cover/${encodeURIComponent(key)}`
export const swatchPath = (bg: string, surface: string, text: string, accent: string) => `/api/local/swatch/${[bg, surface, text, accent].map((c) => c.replace('#', '')).join('-')}`

/** A theme's colours drawn as a small picture: the page, a panel, a line of text, the accent. */
export function swatch(bg: string, surface: string, text: string, accent: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 90"><rect width="160" height="90" fill="${bg}"/><rect x="12" y="14" width="136" height="62" rx="8" fill="${surface}"/><rect x="24" y="28" width="70" height="8" rx="4" fill="${text}"/><rect x="24" y="44" width="46" height="6" rx="3" fill="${text}" opacity=".6"/><rect x="104" y="52" width="32" height="14" rx="7" fill="${accent}"/></svg>`
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
}

export function pictureUrl(path: string): string {
  const m = /^\/api\/local\/(cover|swatch)\/(.+)$/.exec(path)
  if (!m) return path
  if (m[1] === 'cover') return covers.get(decodeURIComponent(m[2])) || ''
  const c = m[2].split('-').map((x) => '#' + x)
  return c.length === 4 && c.every((x) => /^#[0-9a-fA-F]{3,8}$/.test(x)) ? swatch(c[0], c[1], c[2], c[3]) : ''
}

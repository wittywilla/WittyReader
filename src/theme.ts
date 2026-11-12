// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WittyWilla and contributors
import data from './themes.json'

// The library's look: WittyMediaServer's built-in themes (copied into themes.json by
// scripts/sync-themes.mjs), or "system", which follows the device between the default
// dark theme and the light one. Applied as CSS variables on the page, which the reader
// plugins read too, so a book's menus and panels match the library.
export type Theme = { id: string; name: string; description: string; scheme: 'light' | 'dark'; colors: Record<string, string> }
export const THEMES: Theme[] = (data as { themes: Theme[] }).themes
export const SYSTEM = 'system'
const KEY = 'wittyreader.theme'
const applied = new Set<string>()

export function savedTheme(): string {
  try {
    const v = localStorage.getItem(KEY)
    if (v && (v === SYSTEM || THEMES.some((t) => t.id === v))) return v
  } catch { /* storage refused: the default */ }
  return SYSTEM
}

const dark = () => typeof matchMedia === 'function' && !matchMedia('(prefers-color-scheme: light)').matches

/** The theme a choice means right now. */
export function resolveTheme(choice: string, prefersDark = dark()): Theme {
  const found = THEMES.find((t) => t.id === choice)
  if (found) return found
  return (prefersDark ? THEMES.find((t) => t.id === 'default') : THEMES.find((t) => t.scheme === 'light')) || THEMES[0]
}

export function applyTheme(choice: string) {
  const t = resolveTheme(choice)
  const root = document.documentElement
  for (const v of applied) if (!(v in t.colors)) root.style.removeProperty(v)
  applied.clear()
  for (const [v, c] of Object.entries(t.colors)) { root.style.setProperty(v, c); applied.add(v) }
  root.style.colorScheme = t.scheme
  root.dataset.theme = t.id
  root.dataset.scheme = t.scheme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t.colors['--bg'] || '')
  // The desktop app paints its window behind the page to match, so a resize shows no flash.
  ;(window as any).wittyReaderDesktop?.setBackground?.(t.colors['--bg'])
}

export function chooseTheme(choice: string) {
  try { localStorage.setItem(KEY, choice) } catch { /* kept for this visit only */ }
  applyTheme(choice)
}

/** Applies the saved choice, and follows the device while that choice is "system". */
export function startTheme() {
  applyTheme(savedTheme())
  matchMedia?.('(prefers-color-scheme: light)').addEventListener?.('change', () => { if (savedTheme() === SYSTEM) applyTheme(SYSTEM) })
}

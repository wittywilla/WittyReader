// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WittyWilla and contributors
import experiences from '../web/experiences.json'
import { safeColour, type Look, type SceneLayer } from '../web/themeOverrides'
import { themeDeclarations } from '../web/ui/themeMaker'
import type { ImportedTheme, ThemeMeta } from './importTheme'
import { deleteImported, listImported, saveImported } from './store'

// The app's theme engine: the server's two choices, a Look (an experience: finish, shape, type,
// density, focus) and a Theme (colours and scene), worn on <html> as the server's web app does
// (docs/THEMES.md, "A finish"); finish.css and design2.css, copied from the server, draw them.
// The reader keeps its own top-bar layout whatever the Look. The reader plugins' reading colours
// (page, sepia, night) are separate and stay inside the reader.

export type Experience = { id: string; order: number; name: string; tagline: string; description: string; theme: string; effects: Record<string, string>
  shape?: { radiusMultiple?: number; cardSet?: string }; type?: string; density?: string; motion?: { focus?: string; screen?: string }; preview: { bg: string; surface: string; accent: string } }
export const EXPERIENCES = (experiences as { experiences: Experience[] }).experiences
export type ThemeInfo = { id: string; name: string; description: string; scheme: 'dark' | 'light'; preview: { bg?: string; surface?: string; text?: string; accent?: string }; imported?: boolean }

/** The choices that are not one theme: the Look's own default theme, or the device's light or dark. */
export const LOOKS_OWN = 'look'
export const AUTO = 'auto'
export const DEFAULT_LOOK = 'lumen'
const K = { theme: 'wittyreader.theme', look: 'wittyreader.look', first: 'wittyreader.firstRun' }
const get = (k: string) => { try { return localStorage.getItem(k) } catch { return null } }
const put = (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* kept for this visit only */ } }

let builtIn: ThemeInfo[] = []
let imported: ThemeInfo[] = []
let importedFull = new Map<string, ImportedTheme>()
export const themes = (): ThemeInfo[] => [...builtIn, ...imported]
export const findTheme = (id: string) => themes().find((t) => t.id === id)
export const savedLook = (): string => { const v = get(K.look); return EXPERIENCES.some((e) => e.id === v) ? v! : DEFAULT_LOOK }
export const savedTheme = (): string => { const v = get(K.theme); return v === AUTO || v === LOOKS_OWN || (v && themes().some((t) => t.id === v)) ? v! : LOOKS_OWN }
export const firstRunDone = () => get(K.first) === '1'
export const finishFirstRun = () => put(K.first, '1')

// ---- what is on <html>
const EFFECTS = ['glass', 'gloss', 'glow', 'texture', 'bevel']
const GLOSS = ['hi', 'up', 'lo', 'glow', 'edge']
let lookProps: string[] = []
let customProps: string[] = []
let scene: SceneLayer[] = []
let look: Look | undefined
const listeners = new Set<() => void>()
export const sceneLayers = () => scene
export const currentLook = () => look
export const subscribeScene = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l) } }
const setScene = (layers: SceneLayer[]) => { if (JSON.stringify(layers) !== JSON.stringify(scene)) { scene = layers; listeners.forEach((l) => l()) } }

/** Wears a finished look on <html>: what web/src/theme.ts `applyLook` sets, from the same data. */
export function wearLook(l: Look | undefined, root: HTMLElement = document.documentElement) {
  const d = root.dataset
  for (const p of lookProps) root.style.removeProperty(p)
  lookProps = []
  look = l
  const put = (name: string, value: string | number) => { root.style.setProperty(name, String(value)); lookProps.push(name) }
  if (!l) {
    delete d.experience; delete d.type; delete d.cardSet; delete d.focusStyle; delete d.screen; delete d.scene; delete d.density
    for (const e of EFFECTS) delete d['fx' + e[0].toUpperCase() + e.slice(1)]
    setScene([])
    return
  }
  d.experience = l.experience
  d.type = l.type || 'system'
  d.cardSet = l.shape?.cardSet || 'poster'
  d.focusStyle = (l.motion?.focus as string) || 'ring'
  d.screen = (l.motion?.screen as string) || 'fade'
  for (const e of EFFECTS) d['fx' + e[0].toUpperCase() + e.slice(1)] = l.effects?.[e] || 'none'
  const mult = l.shape?.radiusMultiple
  if (typeof mult === 'number' && mult >= 0 && mult <= 4) put('--shape-mult', mult)
  const g = l.finish?.glass
  if (g) for (const [k, v] of Object.entries(g)) { const c = safeColour(v); if (c) put('--glass-' + k, c) }
  l.finish?.gloss?.slice(0, 5).forEach((c, i) => { const ok = safeColour(c); if (ok) put('--gloss-' + GLOSS[i], ok) })
  const layers = l.scene?.layers || []
  if (layers.length) d.scene = ''; else delete d.scene
  setScene(layers)
  if (l.density && l.density !== 'comfortable') d.density = l.density; else delete d.density
}

const lightDevice = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: light)') : null
const prefersLight = () => !!lightDevice?.matches

/** The theme a pair of choices means right now. */
export function resolveThemeId(theme: string, lookId: string, light = prefersLight()): string {
  if (theme === AUTO) return light ? 'light' : 'default'
  if (theme === LOOKS_OWN) return EXPERIENCES.find((e) => e.id === lookId)?.theme || 'default'
  return theme
}

async function themeJson(id: string): Promise<ThemeMeta & { colors?: Record<string, string> }> {
  const imp = importedFull.get(id)
  if (imp) return imp.meta
  const res = await fetch(`themes/${encodeURIComponent(id)}/theme.json`)
  if (!res.ok) throw new Error(`theme ${id} not found`)
  return res.json()
}

let sheetFor = ''
function clearCustom() {
  for (const p of customProps) document.documentElement.style.removeProperty(p)
  customProps = []
  document.querySelectorAll('link[data-wr-theme]').forEach((l) => l.remove())
  sheetFor = ''
}
async function loadFonts(t: ImportedTheme) {
  // @font-face blocks name files in the ZIP: each is loaded as a FontFace from its bytes.
  const re = /@font-face\s*\{([^}]*)\}/g
  for (const m of t.css.matchAll(re)) {
    const family = /font-family\s*:\s*["']?([^;"']+)["']?/.exec(m[1])?.[1]?.trim()
    const file = /url\(\s*["']?([^)"']+)["']?\s*\)/.exec(m[1])?.[1]
    const bytes = file && t.assets[file.replace(/^\.\//, '')]
    if (!family || !bytes) continue
    try { document.fonts.add(await new FontFace(family, bytes.slice().buffer as ArrayBuffer).load()) } catch { /* the family falls back to the next in --font */ }
  }
}

let token = 0
/** Applies a Look and a Theme choice together: colours, then the Look's finish with the theme's own. */
export async function apply(themeChoice = savedTheme(), lookId = savedLook()) {
  const mine = ++token
  const id = resolveThemeId(themeChoice, lookId)
  const meta = await themeJson(id).catch(() => themeJson('default'))
  if (mine !== token) return
  const root = document.documentElement
  const imp = importedFull.get(id)
  if (imp) {
    clearCustom()
    for (const [name, value] of themeDeclarations(imp.css)) { root.style.setProperty(name, value); customProps.push(name) }
    await loadFonts(imp)
  } else {
    for (const p of customProps) root.style.removeProperty(p)
    customProps = []
    const href = `themes/${encodeURIComponent(id)}/theme.css`
    if (sheetFor !== href) {
      clearCustom()
      const link = document.createElement('link')
      link.rel = 'stylesheet'; link.href = href; link.dataset.wrTheme = '1'
      await new Promise<void>((done) => { link.onload = () => done(); link.onerror = () => done(); document.head.appendChild(link) })
      sheetFor = href
    }
  }
  if (mine !== token) return
  const ex = EXPERIENCES.find((e) => e.id === lookId) || EXPERIENCES[0]
  wearLook({ experience: ex.id, theme: id, effects: ex.effects, shape: ex.shape, type: ex.type, density: ex.density, motion: ex.motion, finish: meta.finish as Look['finish'], scene: meta.scene as { layers?: SceneLayer[] } | undefined })
  root.dataset.theme = id
  root.dataset.scheme = meta.scheme
  root.style.colorScheme = meta.scheme
  const bg = getComputedStyle(root).getPropertyValue('--bg').trim()
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg)
  // The desktop app paints its window behind the page to match, so a resize shows no flash.
  ;(window as unknown as { wittyReaderDesktop?: { setBackground?: (c: string) => void } }).wittyReaderDesktop?.setBackground?.(bg)
  window.dispatchEvent(new Event('wittyreader-look'))
}

export async function chooseTheme(choice: string) { put(K.theme, choice); await apply(choice, savedLook()) }
export async function chooseLook(id: string) { put(K.look, id); await apply(savedTheme(), id) }

/** Reads the shipped themes and the imported ones, applies the saved choice, and follows the device while it is "match". */
export async function startTheme() {
  try { builtIn = ((await (await fetch('themes/index.json')).json()) as { themes: ThemeInfo[] }).themes } catch { builtIn = [] }
  await refreshImported()
  await apply()
  lightDevice?.addEventListener?.('change', () => { if (savedTheme() === AUTO) void apply() })
}

async function refreshImported() {
  const all = await listImported().catch(() => [])
  importedFull = new Map(all.map((t) => [t.meta.id, t]))
  imported = all.map((t) => ({ id: t.meta.id, name: t.meta.name, description: t.meta.description || `Imported${t.meta.author ? ' from ' + t.meta.author : ''}.`, scheme: t.meta.scheme, preview: t.meta.preview || {}, imported: true }))
}
export async function addImported(t: ImportedTheme) { await saveImported(t); await refreshImported() }
export async function removeImported(id: string) {
  await deleteImported(id); await refreshImported()
  if (savedTheme() === id) await chooseTheme(LOOKS_OWN)
}

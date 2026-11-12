// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WittyWilla and contributors
import layouts from '../web/layouts.json' with { type: 'json' }
import { breakpoint } from '../web/sdui/device.ts'
import { CATALOG, VERSION, type Action, type Document, type Layout, type Node, type PageInfo, type Props } from '../web/sdui/types.ts'

// Builders for the documents the local page provider makes: the same shapes the server sends
// (docs/SDUI.md, "The rendered document"), made with plain functions so a page reads like its
// description. Nothing here touches the page or the database.

export const nav = (to: string): Action => ({ type: 'navigate', to })
export const cmd = (op: string, item?: string, params?: Record<string, unknown>): Action => ({ type: 'command', op, ...(item ? { item } : {}), ...(params ? { params } : {}) })
const clean = (p: Props): Props => Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined && v !== '' && v !== null))

export function n(type: string, id: string, props: Props = {}, extra: { children?: Node[]; action?: Action; state?: string } = {}): Node {
  const out: Node = { type, id, props: clean(props) }
  if (extra.children?.length) out.children = extra.children
  if (extra.action) out.action = extra.action
  if (extra.state) out.state = extra.state
  return out
}
export const text = (id: string, t: string, role = 'body', more: Props = {}) => n('Text', id, { text: t, role, ...more })
export const stack = (id: string, children: Node[], more: Props = {}) => n('Stack', id, more, { children })
export const button = (id: string, label: string, action: Action, o: { icon?: string; variant?: 'primary' | 'secondary' | 'ghost' } = {}) => n('Button', id, { label, ...o }, { action })
export const notice = (id: string, t: string, o: { title?: string; tone?: string; icon?: string; button?: string; action?: Action } = {}) =>
  n('Notice', id, { text: t, title: o.title, tone: o.tone, icon: o.icon, buttonLabel: o.button }, { action: o.action })
export const row = (id: string, title: string, o: { subtitle?: string; icon?: string; trailing?: string; action?: Action; image?: Props; progress?: number; badges?: string[] } = {}) =>
  n('ListItem', id, { title, subtitle: o.subtitle, icon: o.icon, trailing: o.trailing, image: o.image, progress: o.progress, badges: o.badges }, { action: o.action })
export const list = (id: string, title: string, items: Node[], o: { empty?: string; dense?: boolean } = {}) =>
  n('List', id, { title, dense: o.dense, empty: o.empty ? 'message' : undefined, emptyText: o.empty }, { children: items, state: !items.length && o.empty ? 'empty' : undefined })
export const grid = (id: string, title: string, cards: Node[], o: { cardStyle?: string; empty?: string } = {}) =>
  n('Grid', id, { title, cardStyle: o.cardStyle, empty: o.empty ? 'message' : undefined, emptyText: o.empty }, { children: cards, state: !cards.length && o.empty ? 'empty' : undefined })
export const shelf = (id: string, title: string, cards: Node[], o: { cardStyle?: string; seeAll?: 'never' } = {}) =>
  n('Shelf', id, { title, cardStyle: o.cardStyle, seeAll: o.seeAll || 'never', peek: true }, { children: cards })
export const card = (id: string, style: string, p: Props, action?: Action) => n('Card', id, { style, ...p }, { action })

/** The device profile a page is fitted to: the server's own for a phone, a tablet, the web or the desktop, at this window. */
export function layoutFor(width: number, height: number, o: { touch?: boolean; desktopShell?: boolean; reducedMotion?: boolean } = {}): Layout {
  const all = layouts.layouts as unknown as Record<string, Layout>
  const kind = width < 600 ? 'phone' : o.touch && width < 1200 ? 'tablet' : o.desktopShell ? 'desktop' : 'web'
  const l = structuredClone(all[kind])
  l.canvas = { width: Math.round(width), height: Math.round(height) }
  l.breakpoint = breakpoint(width)
  if (o.reducedMotion) l.reducedMotion = true
  return l
}

const ACTIONABLE = new Set(['Card', 'Button', 'ListItem', 'Notice', 'Banner', 'Tab', 'SearchBox', 'FilterBar', 'DetailHeader'])
const GROUPS = new Set(['Shelf', 'Grid', 'List', 'Tabs', 'Dock', 'Stack', 'Split', 'Page'])

/** Gives every node a person can act on its place in the focus order, in reading order, and one default (docs/SDUI.md, "Focus"). */
export function assignFocus(root: Node): void {
  let order = 0
  let have = false
  const walk = (x: Node, group: string) => {
    const actionable = ACTIONABLE.has(x.type) && (x.action || x.type === 'SearchBox' || x.type === 'FilterBar' || x.type === 'DetailHeader' || x.type === 'Tab' || (x.type === 'Button' && x.props?.to))
    if (actionable) {
      const first = !have && x.type !== 'Tab' && x.type !== 'FilterBar' && x.type !== 'SearchBox'
      x.focus = { order: ++order, group, ...(first ? { default: true } : {}) }
      if (first) have = true
    }
    const next = GROUPS.has(x.type) ? x.id : group
    for (const c of x.children || []) walk(c, next)
  }
  walk(root, root.id)
  // Nothing but search and filters: the first stop takes the default.
  if (!have) { const find = (x: Node): Node | undefined => (x.focus ? x : x.children?.map(find).find(Boolean)); const f = find(root); if (f?.focus) f.focus.default = true }
}

export function document(page: PageInfo, layout: Layout, title: string, children: Node[]): Document {
  const root: Node = { type: 'Page', id: 'page', props: { title, density: layout.density || 'comfortable' }, children }
  assignFocus(root)
  return { version: VERSION, catalog: CATALOG, page, layout, root, meta: { source: 'config', generatedAt: new Date().toISOString(), ttlSeconds: 0 } }
}

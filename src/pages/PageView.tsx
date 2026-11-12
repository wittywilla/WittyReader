// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WittyWilla and contributors
import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { buildPage, sectionGap, type View } from '../web/sdui/model.ts'
import { Ctx, px, type PageCtx } from '../web/sdui/render/context'
import { scopeStyle, Sections } from '../web/sdui/render/components'
import type { Device } from '../web/sdui/device.ts'
import type { Action, Document } from '../web/sdui/types.ts'

// A document, drawn with the server's renderer (the web app's `PageView` in sdui/SduiPage.tsx is tied to its
// server, router and TV input; this is the part a standalone app needs: the model, the page's context and
// the sections). The page's owner supplies what its actions do.
export type Handlers = { act: (a: Action | undefined, from?: View) => void; setQuery: (c: Record<string, string>) => void; menu: (card: View) => void }

export function PageView({ doc, device, handlers }: { doc: Document; device: Device; handlers: Handlers }) {
  const model = useMemo(() => buildPage(doc), [doc])
  const l = model.layout
  const box = useRef<HTMLDivElement | null>(null)
  const [, setWidth] = useState(0)
  useLayoutEffect(() => {
    const el = box.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => setWidth(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const cols = useRef<Record<string, number>>({})
  const ctx = useMemo<PageCtx>(() => ({
    doc, layout: l, device, tv: false, touch: device.capabilities.includes('touch') && !device.capabilities.includes('pointer'), reducedMotion: !!l.reducedMotion, pt: 1,
    act: handlers.act, more: () => {}, busy: () => false, failed: () => false, setQuery: handlers.setQuery, menu: (v) => handlers.menu(v),
    columns: (id, n) => { cols.current[id] = n },
  }), [doc, l, device, handlers])
  const first = model.root.children[0]
  const ownHeading = !first || first.type === 'DetailHeader'
  const style = {
    '--sdui-gap': px(sectionGap(l), 1), '--section-gap': px(sectionGap(l), 1), '--sdui-pt': '1',
    '--sdui-xs': px(l.spacing.xs || 4, 1), '--sdui-s': px(l.spacing.s || 8, 1), '--sdui-m': px(l.spacing.m || 16, 1), '--sdui-l': px(l.spacing.l || 24, 1), '--sdui-xl': px(l.spacing.xl || 48, 1),
    ...scopeStyle(doc.theme),
  } as CSSProperties
  const title = model.root.label || doc.page.title
  return (
    <Ctx.Provider value={ctx}>
      <div ref={box} className={`sdui ff-${l.formFactor} bp-${l.breakpoint} density-${l.density || 'comfortable'} kind-${doc.page.kind}`} style={style} data-sdui-page={doc.page.id}>
        {title && <h1 className={ownHeading ? 'sr-only' : 'sdui-page-title'}>{title}</h1>}
        <Sections views={model.root.children} />
      </div>
    </Ctx.Provider>
  )
}

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WittyWilla and contributors
// A look's layout drawn small, from its `wire` (docs/SDUI.md, "wire"): where the menu is and how it is drawn, what
// the home page opens with, the shape of the cards, the finish; in a theme's colours. The Look and Theme pickers show
// these so a person sees the layout they are choosing and not only its colours.

export type Wire = { nav: string; open?: boolean; style: string; home: string; cards: string; dock?: boolean; brand: string; finish: string }
export type Palette = { bg: string; surface: string; text: string; accent: string }

const f = (n: number) => Math.round(n * 10) / 10
const r = (x: number, y: number, w: number, h: number, fill: string, rx = 0, o = '') => `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="${rx}" fill="${fill}" ${o}/>`

/** The picture, as SVG text, 320 by 180. */
export function wireSvg(w: Wire, p: Palette): string {
  const W = 320, H = 180
  const out: string[] = [r(0, 0, W, H, p.bg)]
  const pill = w.style === 'pill' || w.style === 'gloss' ? 5 : w.style === 'tele' || w.style === 'crossbar' ? 0 : 2
  const gloss = w.finish === 'gloss' || w.finish === 'glass'
  // The area the page has, after the menu.
  let x0 = 0, y0 = 0, x1 = W, y1 = H
  const item = (x: number, y: number, wi: number, hi: number, on: boolean) => {
    if (w.style === 'under') { out.push(r(x, y + hi - 1.5, wi, 1.5, on ? p.accent : p.text, 0, on ? '' : 'opacity=".35"')); return }
    if (w.style === 'tele') { out.push(r(x, y, wi, hi, on ? p.accent : p.surface)); return }
    out.push(r(x, y, wi, hi, on ? p.accent : p.text, pill, on ? '' : 'opacity=".25"'))
  }
  switch (w.nav) {
    case 'top': {
      out.push(r(0, 0, W, 22, p.surface, 0, gloss ? 'opacity=".9"' : ''))
      out.push(r(8, 7, 30, 8, p.accent, 2))
      for (let i = 0; i < 4; i++) item(60 + i * 38, 6, 32, 10, i === 0)
      y0 = 22; break
    }
    case 'side': {
      out.push(r(0, 0, 58, H, p.surface))
      out.push(r(8, 8, 40, 8, p.accent, 2))
      for (let i = 0; i < 5; i++) { item(8, 28 + i * 18, 42, 12, i === 0); if (w.open) out.push(r(14, 32 + i * 18, 26, 3, p.text, 1.5, 'opacity=".6"')) }
      x0 = 58; break
    }
    case 'rail': {
      out.push(r(0, 0, 22, H, p.surface))
      out.push(r(5, 8, 12, 12, p.accent, 3))
      for (let i = 0; i < 5; i++) out.push(`<circle cx="11" cy="${36 + i * 18}" r="4.5" fill="${i === 0 ? p.accent : p.text}" ${i === 0 ? '' : 'opacity=".3"'}/>`)
      x0 = 22; break
    }
    case 'bottom': {
      out.push(r(0, H - 22, W, 22, p.surface))
      for (let i = 0; i < 4; i++) out.push(`<circle cx="${60 + i * 66}" cy="${H - 11}" r="4.5" fill="${i === 0 ? p.accent : p.text}" ${i === 0 ? '' : 'opacity=".3"'}/>`)
      y1 = H - 22; break
    }
    default: break
  }
  const cw = x1 - x0, pad = 12, cx = x0 + pad, cwi = cw - pad * 2
  let y = y0 + 10
  // What the page opens with.
  switch (w.home) {
    case 'hero': out.push(r(cx, y, cwi, 50, p.surface, 4), r(cx + 8, y + 28, cwi * .45, 5, p.text, 2.5), r(cx + 8, y + 37, cwi * .25, 4, p.text, 2, 'opacity=".5"'), r(cx + 8, y + 12, 30, 9, p.accent, pill)); y += 58; break
    case 'banner': out.push(r(cx, y, cwi, 30, p.surface, 4), r(cx + 8, y + 10, cwi * .35, 5, p.text, 2.5), r(cx + cwi - 40, y + 10, 32, 10, p.accent, pill)); y += 38; break
    case 'carousel': out.push(r(cx + cwi * .2, y, cwi * .6, 50, p.surface, 4), r(cx, y + 6, cwi * .15, 38, p.surface, 4, 'opacity=".6"'), r(cx + cwi * .85, y + 6, cwi * .15, 38, p.surface, 4, 'opacity=".6"')); y += 58; break
    case 'cross': for (let i = 0; i < 6; i++) out.push(`<circle cx="${f(cx + 14 + i * (cwi - 28) / 5)}" cy="${y + 16}" r="${i === 2 ? 14 : 9}" fill="${i === 2 ? p.accent : p.surface}"/>`); y += 40; break
    case 'tiles': for (let i = 0; i < 3; i++) out.push(r(cx + i * (cwi / 3), y, cwi / 3 - 5, 44, i === 0 ? p.accent : p.surface, 4)); y += 52; break
    case 'widgets': for (let i = 0; i < 4; i++) out.push(r(cx + (i % 2) * (cwi / 2), y + Math.floor(i / 2) * 26, cwi / 2 - 5, 22, p.surface, 3), r(cx + 6 + (i % 2) * (cwi / 2), y + 8 + Math.floor(i / 2) * 26, cwi * .18, 4, i === 0 ? p.accent : p.text, 2, i === 0 ? '' : 'opacity=".5"')); y += 56; break
    case 'list': for (let i = 0; i < 4; i++) out.push(r(cx, y + i * 13, cwi, 10, p.surface, w.style === 'tele' ? 0 : 3), r(cx + 6, y + 3.5 + i * 13, cwi * (.5 - i * .06), 3, i === 0 ? p.accent : p.text, 1.5, i === 0 ? '' : 'opacity=".6"')); y += 58; break
    default: break
  }
  // A row of cards in the shape the look draws.
  const n = w.cards === 'poster' || w.cards === 'plate' ? 6 : 4
  const ch = w.cards === 'poster' || w.cards === 'plate' ? 34 : w.cards === 'logo' ? 16 : 24
  const room = y1 - y - 8
  const hh = Math.min(ch, room)
  if (hh > 8) for (let i = 0; i < n; i++) {
    const wi = cwi / n - 5, x = cx + i * (cwi / n)
    out.push(r(x, y, wi, hh, w.cards === 'block' ? (i % 2 ? p.surface : p.accent) : p.surface, w.cards === 'block' ? 0 : 3))
    if (w.cards === 'plate') out.push(r(x, y + hh - 8, wi, 8, p.bg, 0, 'opacity=".6"'))
    out.push(r(x, y + hh + 3, wi * .7, 3, p.text, 1.5, 'opacity=".5"'))
  }
  if (w.dock) out.push(r(x0 + 12, y1 - 10, cwi, 6, p.surface, 3))
  if (gloss) out.push(`<rect width="${W}" height="${H / 2}" fill="#fff" opacity=".06"/>`)
  if (w.finish === 'crt') for (let i = 0; i < H; i += 3) out.push(r(0, i, W, 1, '#000', 0, 'opacity=".18"'))
  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 ${W} ${H}">${out.join('')}</svg>`
}

export const wireUrl = (w: Wire, p: Palette) => 'data:image/svg+xml;utf8,' + encodeURIComponent(wireSvg(w, p))

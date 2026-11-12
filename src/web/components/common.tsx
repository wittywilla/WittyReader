// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WittyWilla and contributors
import type { CSSProperties } from 'react'
import { avatarColor } from '../ui/avatarColor'

// A seam of the app: the art for something without a picture, worked out from its title as the server's does.
const artHue = (title: string) => {
  let h = 0
  for (const c of title) h = (h * 31 + c.charCodeAt(0)) % 360
  return h
}
export function Placeholder({ title, label }: { title: string; label?: string }) {
  const h = artHue(title)
  return (
    <div className={'ph art-ph' + (label ? ' labelled' : '')} style={{ '--ph-art': `linear-gradient(155deg, hsl(${h} 32% 32%), hsl(${(h + 40) % 360} 38% 15%))`, '--ph': avatarColor(title) } as CSSProperties} aria-hidden="true">
      <b>{label || title}</b>
    </div>
  )
}

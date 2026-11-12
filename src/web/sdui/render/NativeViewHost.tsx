// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WittyWilla and contributors
import type { ReactNode } from 'react'
import type { Props } from '../types'

// A seam of the app: the server's renderer hands a NativeView to the app's own rich views (the TV guide, photo
// timeline). The reader has none, so, as docs/SDUI.md says for an app without the view, the sections inside are drawn.
export default function NativeViewHost({ children }: { view: string; library: string; inert: boolean; props: Props; children?: ReactNode }) {
  return <>{children}</>
}

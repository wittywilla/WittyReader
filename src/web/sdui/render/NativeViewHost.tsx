// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WittyWilla and contributors
import type { ReactNode } from 'react'
import { Bookshelf } from '@wittywilla/wittyink'
import { shelfHost } from '../../../pages/shelfHost'
import type { Props } from '../types'

// A seam of the app: the server's renderer hands a NativeView to the app's own rich views. The reader has one, WittyInk's
// bookshelf (its module view `wittyink.bookshelf`, answered from this device's library); for any other view, as docs/SDUI.md
// says for an app without it, the sections inside are drawn.
export default function NativeViewHost({ view, library, children }: { view: string; library: string; inert: boolean; props: Props; children?: ReactNode }) {
  if (view === 'wittyink.bookshelf') return <Bookshelf host={shelfHost} library={library || '1'} />
  return <>{children}</>
}

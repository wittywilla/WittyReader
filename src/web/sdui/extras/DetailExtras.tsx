// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WittyWilla and contributors
import type { Node } from '../types'

// A seam of the app: the server adds tools and extras (collections, matching, editing) to a title's header. A book has none.
export default function DetailExtras(_: { place: 'tools' | 'below'; header: Node; doc: { root: Node } }) { return null }

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WittyWilla and contributors
import type { PageHost, ShelfBook } from '@wittywilla/wittyink'
import { books } from '../store'

// The page host WittyInk's bookshelf view (`wittyink.bookshelf`) asks for, answered from the library on this device: the view
// asks `GET /items?library=…&kind=book&sort=title` of a server, and here that is the local books. Numbers stand in for the
// books' ids (the view's shape) and are remembered so a click opens the right book. Covers are not served (there is no server
// to ask), so the shelf draws its lettered covers.
let ids: string[] = []
export const bookOfShelfId = (id: number): string | undefined => ids[id - 1]

export const shelfHost: PageHost = {
  user: { admin: false },
  token: () => '',
  base: () => '',
  request: async <T,>(method: string, path: string): Promise<T> => {
    if (method !== 'GET' || !/^\/items\?/.test(path)) throw new Error('not available in WittyReader')
    const all = await books.all()
    ids = all.map((b) => b.key)
    const items: ShelfBook[] = all.map((b, i) => ({
      id: i + 1, title: b.title, artist: b.author, year: b.year ?? null, reader: b.format, container: b.format, reading: b.reading,
      addedAt: Math.floor(b.added / 1000), updatedAt: Math.floor(Math.max(b.added, b.opened) / 1000),
      progress: b.total ? { positionSec: b.position, durationSec: b.total } : null,
    }))
    return { items } as T
  },
}

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WittyWilla and contributors
import { books, notes } from '../store'
import { EXPERIENCES, savedLook, savedTheme, themes } from '../theme/engine'
import { registerCover } from './pictures'
import type { Data } from './local.ts'
import type { Note } from '../library.ts'

export const DICT_KEY = 'wittyreader.dictionary'
export const dictionaryOn = () => { try { return localStorage.getItem(DICT_KEY) === '1' } catch { return false } }

/** Reads what the pages are made from: the library, its notes, the settings and the themes. */
export async function loadData(version: string): Promise<Data> {
  const [bs, ns] = await Promise.all([books.all(), notes.all()])
  const covered = new Set<string>()
  for (const b of bs) if (b.cover) { registerCover(b.key, b.cover); covered.add(b.key) }
  const title = new Map(bs.map((b) => [b.key, b]))
  const all: Note[] = ns.filter((x) => title.has(x.book)).map((x) => ({ ...x, bookTitle: title.get(x.book)!.title, author: title.get(x.book)!.author }))
  const used = await navigator.storage?.estimate?.().then((e) => `${((e.usage || 0) / 1048576).toFixed(1)} MB`).catch(() => '')
  return {
    books: bs, notes: all, hasCover: (k) => covered.has(k), dictionary: dictionaryOn(), version, used: used || undefined,
    looks: EXPERIENCES.map((e) => ({ id: e.id, name: e.name, tagline: e.tagline, description: e.description, preview: e.preview })),
    themes: themes(), look: savedLook(), theme: savedTheme(),
  }
}

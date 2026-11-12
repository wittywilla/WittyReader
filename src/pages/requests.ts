// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WittyWilla and contributors
import { strToU8, zipSync } from 'fflate'
import { clean, saveSettings, settingRow } from '../modules/settings.ts'
import { filterNotes, notesBackups, notesMarkdown, type Note, type NoteFilter } from '../library.ts'

// What a page's commands do. The pages carry `command` actions; the renderer's `plan` turns each into a request
// (method and path, the server's way); this answers it. A remote provider would send the same request to a
// server instead. The paths are listed in pages/local.ts `COMMANDS`.

export type Host = {
  toast: (m: string) => void
  pick: (what: 'books' | 'notes' | 'theme') => void
  removeBook: (key: string) => Promise<void>
  exportBook: (key: string) => Promise<void>
  notes: () => Promise<Note[]>
  save: (name: string, data: Blob) => void
  setDictionary: () => void
  setTheme: (id: string) => Promise<void>
  setLook: (id: string) => Promise<void>
  removeTheme: (id: string) => Promise<void>
  finishWelcome: () => void
  refresh: () => void
}

type Body = Record<string, string> | undefined
const ROUTE: [RegExp, string][] = [
  [/^\/reader\/pick\/(books|notes|theme)$/, 'pick'], [/^\/reader\/books\/([^/]+)\/remove$/, 'remove'], [/^\/reader\/books\/([^/]+)\/export$/, 'export'],
  [/^\/reader\/notes\/export\/(md|json)$/, 'notes'], [/^\/reader\/dictionary\/toggle$/, 'dictionary'], [/^\/reader\/theme\/([^/]+)$/, 'theme'], [/^\/reader\/look\/([^/]+)$/, 'look'],
  [/^\/reader\/themes\/([^/]+)\/remove$/, 'removeTheme'], [/^\/reader\/welcome\/done$/, 'welcome'], [/^\/reader\/settings\/([a-z]+)\/([A-Za-z]+)$/, 'setting'],
]

export const noteFilter = (b: Body): NoteFilter => ({ book: b?.book || undefined, kind: (b?.kind || 'all') as NoteFilter['kind'], color: b?.color || undefined, q: b?.q || undefined, withNote: b?.withNote === '1' })

/** The files a notes export makes: one Markdown file, one backup, or a ZIP of backups when several books are in it. */
export function notesFiles(list: Note[], format: 'md' | 'json'): { name: string; type: string; data: BlobPart }[] {
  if (format === 'md') return [{ name: 'WittyReader notes.md', type: 'text/markdown', data: notesMarkdown(list) }]
  const backups = notesBackups(list)
  if (backups.length === 1) return [{ name: `${backups[0].book.title} - notes.json`, type: 'application/json', data: JSON.stringify(backups[0], null, 1) }]
  const zip = zipSync(Object.fromEntries(backups.map((b) => [`${b.book.title.replace(/[\\/:*?"<>|]/g, '_')} - notes.json`, strToU8(JSON.stringify(b, null, 1))])))
  return [{ name: 'WittyReader notes.zip', type: 'application/zip', data: zip as unknown as BlobPart }]
}

export async function request(method: string, path: string, body: Body, host: Host): Promise<void> {
  const hit = ROUTE.map(([re, op]) => [re.exec(path), op] as const).find(([m]) => m)
  if (!hit || method !== 'POST') return
  const [m, op] = hit
  const arg = decodeURIComponent(m![1] || '')
  switch (op) {
    case 'pick': host.pick(arg as 'books'); break
    case 'remove': await host.removeBook(arg); break
    case 'export': await host.exportBook(arg); break
    case 'dictionary': host.setDictionary(); break
    case 'theme': await host.setTheme(arg); break
    case 'look': await host.setLook(arg); break
    case 'removeTheme': await host.removeTheme(arg); break
    case 'welcome': host.finishWelcome(); break
    case 'setting': {
      // Only a key the module has, and a value its row allows.
      const row = settingRow(arg, decodeURIComponent(m![2]))
      const v = row && clean(row, body?.value)
      if (row && v !== undefined) { saveSettings(arg, { [row.key]: v }); host.refresh() }
      break
    }
    case 'notes': {
      const list = filterNotes(await host.notes(), noteFilter(body))
      if (!list.length) { host.toast('There are no notes to export with these filters.'); break }
      for (const f of notesFiles(list, arg as 'md')) host.save(f.name, new Blob([f.data], { type: f.type }))
      break
    }
  }
}

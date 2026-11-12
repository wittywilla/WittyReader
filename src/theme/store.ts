// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WittyWilla and contributors
import type { ImportedTheme } from './importTheme'

// Imported themes live in their own small database, so a theme can never touch the library's.
let dbp: Promise<IDBDatabase> | null = null
const db = () => (dbp ??= new Promise((resolve, reject) => {
  const r = indexedDB.open('wittyreader-themes', 1)
  r.onupgradeneeded = () => { r.result.createObjectStore('themes', { keyPath: 'meta.id' }) }
  r.onsuccess = () => resolve(r.result)
  r.onerror = () => reject(r.error)
}))
const run = <T,>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void) => db().then((d) => new Promise<T>((resolve, reject) => {
  const t = d.transaction('themes', mode)
  const req = fn(t.objectStore('themes'))
  t.oncomplete = () => resolve(req ? req.result : (undefined as T))
  t.onerror = () => reject(t.error)
  t.onabort = () => reject(t.error || new Error('Storage is full or unavailable'))
}))
export const listImported = () => run<ImportedTheme[]>('readonly', (s) => s.getAll())
export const saveImported = (t: ImportedTheme) => run('readwrite', (s) => { s.put(t) })
export const deleteImported = (id: string) => run('readwrite', (s) => { s.delete(id) })

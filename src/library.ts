// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WittyWilla and contributors
// The library's own logic, with no page and no database: how far through a book is, what a search and a
// filter leave, the order of the shelf, and a set of notes as Markdown or JSON. The pages (src/pages)
// are made from these, and the tests (scripts/test) run them.
import type { Ann } from '@wittywilla/wittyink'

export type Format = 'epub' | 'pdf' | 'cbz'
export type Book = { key: string; title: string; author?: string; format: Format; total: number; position: number; words?: number[]; added: number; opened: number }
export type Sort = 'recent' | 'added' | 'title' | 'author'
export type KindFilter = 'all' | Format
export const FORMAT_NAMES: Record<Format, string> = { epub: 'EPUB', pdf: 'PDF', cbz: 'Comic' }
export const KIND_NAMES: Record<KindFilter, string> = { all: 'All', epub: 'Books', pdf: 'PDFs', cbz: 'Comics' }
export const SORTS: { value: Sort; label: string }[] = [{ value: 'recent', label: 'Recently read' }, { value: 'added', label: 'Recently added' }, { value: 'title', label: 'Title' }, { value: 'author', label: 'Author' }]

// How far through a book is, as its reader counts it. A PDF or comic is saved at the page on
// screen, so its last page is the end. A book counts words, and its reader's last page starts
// a little before them, so its last chapter with less than two pages' worth left is the end.
export function progress(b: Pick<Book, 'format' | 'total' | 'position' | 'words' | 'opened'>): number {
  if (!b.total || (!b.opened && !b.position)) return 0
  const page = Math.max(0, Math.min(b.total - 1, Math.floor(b.position)))
  const sum = (l: number[]) => l.reduce((x, y) => x + y, 0)
  const all = b.words?.length === b.total ? sum(b.words) : -1
  if (b.format !== 'epub' || all === 0) return Math.round(((page + 1) / b.total) * 100)
  if (all < 0) return Math.min(99, Math.round((b.position / b.total) * 100))
  const left = b.words![page] * (1 - (b.position - page))
  if (page === b.total - 1 && left < 600) return 100
  return Math.min(99, Math.round(((sum(b.words!.slice(0, page)) + b.words![page] - left) / all) * 100))
}

const last = (b: Book) => Math.max(b.opened, b.added)
export function shelf(all: Book[], o: { q?: string; kind?: KindFilter; sort?: Sort }): Book[] {
  const q = (o.q || '').trim().toLowerCase()
  const out = all.filter((b) => (!o.kind || o.kind === 'all' || b.format === o.kind) && (!q || `${b.title} ${b.author || ''}`.toLowerCase().includes(q)))
  const by: Record<Sort, (a: Book, b: Book) => number> = {
    recent: (a, b) => last(b) - last(a),
    added: (a, b) => b.added - a.added,
    title: (a, b) => a.title.localeCompare(b.title),
    author: (a, b) => +!a.author - +!b.author || (a.author || '').localeCompare(b.author || '') || a.title.localeCompare(b.title), // no author last
  }
  return out.sort(by[o.sort || 'recent'])
}
/** The book being read: opened most recently, neither new nor finished. */
export const current = (all: Book[]): Book | undefined => all.filter((b) => (b.opened || b.position) && progress(b) > 0 && progress(b) < 100).sort((a, b) => b.opened - a.opened)[0]

// ---------------------------------------------------------------- notes across the library
export type NoteKind = Ann['kind']
export type Note = Ann & { book: string; bookTitle: string; author?: string }
export const NOTE_KINDS: { value: NoteKind | 'all'; label: string }[] = [{ value: 'all', label: 'All' }, { value: 'highlight', label: 'Highlights' }, { value: 'bookmark', label: 'Bookmarks' }, { value: 'ink', label: 'Drawings' }]
export type NoteFilter = { book?: string; kind?: NoteKind | 'all'; color?: string; q?: string; withNote?: boolean }

export function filterNotes(all: Note[], f: NoteFilter): Note[] {
  const q = (f.q || '').trim().toLowerCase()
  return all.filter((n) => (!f.book || n.book === f.book) && (!f.kind || f.kind === 'all' || n.kind === f.kind) && (!f.color || n.color === f.color) && (!f.withNote || !!n.note)
    && (!q || `${n.quote} ${n.note} ${n.bookTitle}`.toLowerCase().includes(q)))
    .sort((a, b) => a.bookTitle.localeCompare(b.bookTitle) || a.chapter - b.chapter || a.pos - b.pos || a.id - b.id)
}

export function notesMarkdown(list: Note[]): string {
  const out: string[] = ['# Notes and highlights', '']
  let book = ''
  for (const n of list) {
    if (n.book !== book) { book = n.book; out.push(`## ${n.bookTitle}${n.author ? ` (${n.author})` : ''}`, '') }
    if (n.kind === 'ink') { out.push(`- Drawing on page ${n.chapter + 1}${n.note ? `: ${n.note}` : ''}`); continue }
    const label = n.kind === 'bookmark' ? 'Bookmark' : 'Highlight'
    out.push(n.quote ? `> ${n.quote.replace(/\s*\n\s*/g, ' ')}` : `- ${label}`, ...(n.note ? ['', n.note] : []), '')
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n'
}

export type Backup = { app: 'wittyreader'; version: 1; book: { key: string; title: string; author?: string }; annotations: Ann[] }
/** One backup file per book, in the shape `importNotesFile` reads. */
export function notesBackups(list: Note[]): Backup[] {
  const by = new Map<string, Backup>()
  for (const { book, bookTitle, author, ...a } of list) {
    if (!by.has(book)) by.set(book, { app: 'wittyreader', version: 1, book: { key: book, title: bookTitle, author }, annotations: [] })
    by.get(book)!.annotations.push(a as Ann)
  }
  return [...by.values()]
}

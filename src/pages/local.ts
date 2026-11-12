// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WittyWilla and contributors
import { current, filterNotes, FORMAT_NAMES, KIND_NAMES, NOTE_KINDS, progress, SORTS, shelf as shelfOf, type Book, type KindFilter, type Note, type NoteFilter, type Sort } from '../library.ts'
import { CATALOG, VERSION, type Document, type Layout, type Navigation, type Node } from '../web/sdui/types.ts'
import { setCommandSpecs, type CommandSpec, type RouteRule } from '../web/sdui/routes.ts'
import { card, cmd, document, grid, list, n, nav, notice, row, shelf, stack, text, button } from './doc.ts'
import { coverPath, swatchPath } from './pictures.ts'

// The local page provider: the app's own data (the library, its notes, its settings) as SDUI documents of the
// server's catalogue. `Data` is what a page is made from, read by the app (src/pages/data.ts) so this file
// has no database in it and is tested with plain objects. See docs/SDUI-ARCHITECTURE.md.

export type ThemeChoice = { id: string; name: string; description: string; scheme: string; preview: { bg?: string; surface?: string; text?: string; accent?: string }; imported?: boolean }
export type LookChoice = { id: string; name: string; tagline: string; description: string; preview: { bg: string; surface: string; accent: string } }
export type Data = {
  books: Book[]; notes: Note[]; hasCover: (key: string) => boolean
  dictionary: boolean; version: string; used?: string
  looks: LookChoice[]; themes: ThemeChoice[]; look: string; theme: string
}

/** The addresses of the app: a page is asked for by id, or one of the app's own screens (the reading surface) is opened. */
export const ROUTES: RouteRule[] = [
  { route: '/', page: 'reader-library' },
  { route: '/search', page: 'reader-library' },
  { route: '/book/{item}', page: 'reader-book', params: { item: '{item}' } },
  { route: '/notes', page: 'reader-notes' },
  { route: '/import', page: 'reader-import' },
  { route: '/settings', page: 'reader-settings' },
  { route: '/welcome', page: 'reader-welcome' },
  { route: '/read/{item}', native: 'reader' },
]

// What a page's buttons ask the app to do: the same `command` actions the server's pages carry, answered here.
export const COMMANDS: CommandSpec[] = [
  { op: 'reader.pick', method: 'POST', path: '/api/v1/reader/pick/{what}', params: [{ name: 'what', type: 'string', required: true }] },
  { op: 'reader.remove', method: 'POST', path: '/api/v1/reader/books/{item}/remove' },
  { op: 'reader.export', method: 'POST', path: '/api/v1/reader/books/{item}/export' },
  { op: 'reader.notes.export', method: 'POST', path: '/api/v1/reader/notes/export/{format}', body: '{"book":"{book}","kind":"{kind}","color":"{color}","q":"{q}","withNote":"{withNote}"}', params: [{ name: 'format', type: 'string', required: true }, { name: 'book', type: 'string' }, { name: 'kind', type: 'string' }, { name: 'color', type: 'string' }, { name: 'q', type: 'string' }, { name: 'withNote', type: 'string' }] },
  { op: 'reader.dictionary.toggle', method: 'POST', path: '/api/v1/reader/dictionary/toggle' },
  { op: 'reader.theme.set', method: 'POST', path: '/api/v1/reader/theme/{id}', params: [{ name: 'id', type: 'string', required: true }] },
  { op: 'reader.look.set', method: 'POST', path: '/api/v1/reader/look/{id}', params: [{ name: 'id', type: 'string', required: true }] },
  { op: 'reader.theme.remove', method: 'POST', path: '/api/v1/reader/themes/{id}/remove', params: [{ name: 'id', type: 'string', required: true }] },
  { op: 'reader.welcome.done', method: 'POST', path: '/api/v1/reader/welcome/done' },
]
export const registerCommands = () => setCommandSpecs(COMMANDS)

export function navigation(formFactor: string): Navigation {
  const item = (id: string, label: string, icon: string, route: string) => ({ id, label, icon, kind: 'page', page: id, route, placement: 'primary' })
  return { version: VERSION, formFactor, items: [item('reader-library', 'Library', 'library', '/'), item('reader-notes', 'Notes', 'list', '/notes'), item('reader-import', 'Import', 'download', '/import'), item('reader-settings', 'Settings', 'settings', '/settings')] }
}

const cover = (b: Book, has: boolean) => (has ? { url: coverPath(b.key), aspect: '2/3', kind: 'poster' } : undefined)
const bookCard = (b: Book, data: Data, id: string, to = `/book/${b.key}`): Node => {
  const pct = progress(b)
  return card(`${id}:${b.key}`, 'book', {
    title: b.title, subtitle: b.author || (pct ? '' : 'New'), kind: 'book', itemId: b.key, image: cover(b, data.hasCover(b.key)),
    progress: pct > 0 && pct < 100 ? pct / 100 : undefined, watched: pct >= 100 || undefined, badges: [FORMAT_NAMES[b.format], ...(pct >= 100 ? ['Finished'] : [])],
  }, nav(to))
}
const options = <T extends string>(l: { value: T; label: string }[]) => l.map((o) => ({ value: o.value, label: o.label }))

function library(data: Data, q: URLSearchParams): Node[] {
  const kind = (q.get('kind') || 'all') as KindFilter, sort = (q.get('sort') || 'recent') as Sort, search = q.get('q') || ''
  const kinds = (['epub', 'pdf', 'cbz'] as const).filter((k) => data.books.some((b) => b.format === k))
  if (!data.books.length) {
    return [n('Banner', 'empty', { title: 'Your reading, on your device', text: 'Add an EPUB book, a PDF or a CBZ comic, or drop files anywhere on this window. Highlight, take notes and write with a pen; everything stays on this device.', icon: 'book', buttonLabel: 'Add books', style: 'promo' }, { action: cmd('reader.pick', undefined, { what: 'books' }) })]
  }
  const shown = shelfOf(data.books, { q: search, kind, sort })
  const reading = !search && kind === 'all' ? current(data.books) : undefined
  const out: Node[] = []
  if (reading) out.push(shelf('continue', 'Continue reading', [bookCard(reading, data, 'continue', `/read/${reading.key}`)], { cardStyle: 'book' }))
  out.push(n('FilterBar', 'filters', {
    target: 'all', showCount: true, count: shown.length, countText: `${shown.length} ${shown.length === 1 ? 'title' : 'titles'}`,
    sort: { id: 'sort', label: 'Sort', value: sort, options: options(SORTS) },
    fields: kinds.length > 1 ? [{ id: 'kind', label: 'Show', value: kind === 'all' ? '' : kind, options: kinds.map((k) => ({ value: k, label: KIND_NAMES[k] })) }] : [],
  }))
  out.push(shown.length || !search ? grid('all', 'Library', shown.map((b) => bookCard(b, data, 'all')), { cardStyle: 'book', empty: 'Nothing in your library matches.' })
    : notice('none', `Nothing in your library matches “${search}”.`, { icon: 'search' }))
  return out
}

function bookPage(data: Data, key: string): Node[] | null {
  const b = data.books.find((x) => x.key === key)
  if (!b) return null
  const pct = progress(b)
  const notes = filterNotes(data.notes, { book: key })
  return [
    n('DetailHeader', 'header', {
      layout: 'poster', title: b.title, tagline: b.author, kind: 'book', progress: pct > 0 && pct < 100 ? pct / 100 : undefined,
      images: data.hasCover(key) ? { poster: { url: coverPath(key), aspect: '2/3', kind: 'poster' } } : undefined,
      facts: [{ id: 'format', value: FORMAT_NAMES[b.format] }, ...(pct > 0 ? [{ id: 'progress', value: pct >= 100 ? 'Finished' : `${pct}% read` }] : [])],
      actions: [
        { id: 'read', label: pct > 0 && pct < 100 ? 'Continue reading' : pct >= 100 ? 'Read again' : 'Read', icon: 'book', primary: true, action: nav(`/read/${key}`) },
        { id: 'export', label: 'Export notes', icon: 'download', action: cmd('reader.export', key) },
        { id: 'remove', label: 'Remove from this device', icon: 'warning', action: cmd('reader.remove', key) },
      ],
    }),
    list('notes', 'Notes in this book', notes.map((x) => noteRow(x)), { empty: 'No highlights, bookmarks or drawings yet. Make some while you read.' }),
  ]
}

const NOTE_ICON = { highlight: 'sparkles', bookmark: 'star', ink: 'info' } as const
const noteRow = (x: Note): Node => row(`n${x.id}`, x.quote || (x.kind === 'bookmark' ? 'Bookmark' : x.kind === 'ink' ? 'Drawing' : 'Highlight'), {
  subtitle: x.note || undefined, icon: NOTE_ICON[x.kind], trailing: x.kind === 'ink' ? `Page ${x.chapter + 1}` : undefined,
  badges: x.color ? [x.color] : undefined,
})

export const noteFilterOf = (q: URLSearchParams): NoteFilter => ({ book: q.get('book') || undefined, kind: (q.get('kind') || 'all') as NoteFilter['kind'], color: q.get('color') || undefined, q: q.get('q') || undefined, withNote: q.get('withNote') === '1' })

function notesPage(data: Data, q: URLSearchParams): Node[] {
  const f = noteFilterOf(q)
  const shown = filterNotes(data.notes, f)
  const colours = [...new Set(data.notes.map((x) => x.color).filter(Boolean))].sort()
  const books = data.books.filter((b) => data.notes.some((x) => x.book === b.key)).sort((a, b) => a.title.localeCompare(b.title))
  if (!data.notes.length) return [notice('none', 'Highlights, bookmarks and drawings you make while reading are collected here, from every book.', { title: 'No notes yet', icon: 'info' })]
  const params = { book: f.book || '', kind: f.kind === 'all' ? '' : f.kind || '', color: f.color || '', q: f.q || '', withNote: f.withNote ? '1' : '' }
  return [
    n('SearchBox', 'search', { placeholder: 'Search your notes', query: f.q || '' }),
    n('FilterBar', 'filters', {
      target: 'notes', showCount: true, count: shown.length, countText: `${shown.length} ${shown.length === 1 ? 'note' : 'notes'}`,
      fields: [
        { id: 'book', label: 'Book', value: f.book || '', options: books.map((b) => ({ value: b.key, label: b.title })) },
        { id: 'kind', label: 'Type', value: f.kind === 'all' ? '' : f.kind || '', options: options(NOTE_KINDS.filter((k) => k.value !== 'all') as { value: string; label: string }[]) },
        ...(colours.length ? [{ id: 'color', label: 'Colour', value: f.color || '', options: colours.map((c) => ({ value: c, label: c })) }] : []),
        { id: 'withNote', label: 'Written note', value: f.withNote ? '1' : '', options: [{ value: '1', label: 'Only with a note' }] },
      ],
    }),
    list('notes', 'Highlights and notes', shown.map((x) => ({ ...noteRow(x), action: nav(`/book/${x.book}`), props: { ...noteRow(x).props, subtitle: [x.bookTitle, x.note].filter(Boolean).join(' · ') } })), { empty: 'Nothing matches these filters.' }),
    n('Stack', 'export', { direction: 'row', gap: 's' }, { children: [
      button('md', 'Export as Markdown', cmd('reader.notes.export', undefined, { format: 'md', ...params }), { icon: 'download', variant: 'primary' }),
      button('json', 'Export as backup (JSON)', cmd('reader.notes.export', undefined, { format: 'json', ...params }), { icon: 'download' }),
    ] }),
  ]
}

function importPage(): Node[] {
  return [
    text('add-h', 'Add books', 'heading'),
    text('add', 'EPUB books, PDFs and CBZ comics. Drop files anywhere on this window, press Ctrl+O, or choose them here. A single file opens straight away.'),
    stack('add-b', [button('add-btn', 'Choose files…', cmd('reader.pick', undefined, { what: 'books' }), { icon: 'plus', variant: 'primary' })], { direction: 'row' }),
    n('Divider', 'd1'),
    text('notes-h', 'Notes from another device', 'heading'),
    text('notes', 'Adds notes exported from WittyReader elsewhere to the matching books here. Notes already there are not added twice.'),
    stack('notes-b', [button('notes-btn', 'Import notes…', cmd('reader.pick', undefined, { what: 'notes' }), { icon: 'download' })], { direction: 'row' }),
    notice('private', 'Books and notes stay on this device. Nothing is uploaded.', { icon: 'info' }),
  ]
}

const inkOn = (bg: string) => { const h = bg.replace('#', ''); const v = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) || 0); return v[0] * 0.299 + v[1] * 0.587 + v[2] * 0.114 > 150 ? '#1a1a1a' : '#f4f4f4' }
const swatchOf = (p: { bg?: string; surface?: string; text?: string; accent?: string }) => { const bg = p.bg || '#0f1115'; return swatchPath(bg, p.surface || bg, p.text || inkOn(p.surface || bg), p.accent || '#7955ff') }

function pickers(data: Data): Node[] {
  const used = (id: string) => data.theme === id
  const themeCards: Node[] = [
    card('t:auto', 'landscape', { title: 'Match this device', subtitle: 'Witty when the device is dark, Light when it is light.', kind: 'collection', icon: 'devices', badges: used('auto') ? ['In use'] : [] }, cmd('reader.theme.set', undefined, { id: 'auto' })),
    card('t:look', 'landscape', { title: 'The Look’s own', subtitle: 'Each Look has a theme of its own.', kind: 'collection', icon: 'sparkles', badges: used('look') ? ['In use'] : [] }, cmd('reader.theme.set', undefined, { id: 'look' })),
    ...data.themes.map((t) => card(`t:${t.id}`, 'landscape', { title: t.name, subtitle: t.description, image: { url: swatchOf(t.preview), aspect: '16/9', kind: 'backdrop' }, badges: [...(used(t.id) ? ['In use'] : []), ...(t.imported ? ['Imported'] : [])] }, cmd('reader.theme.set', undefined, { id: t.id }))),
  ]
  const lookCards = data.looks.map((l) => card(`l:${l.id}`, 'landscape', { title: l.name, subtitle: `${l.tagline}. ${l.description}`, image: { url: swatchOf({ bg: l.preview.bg, surface: l.preview.surface, accent: l.preview.accent }), aspect: '16/9', kind: 'backdrop' }, badges: data.look === l.id ? ['In use'] : [] }, cmd('reader.look.set', undefined, { id: l.id })))
  return [grid('looks', 'Look', lookCards, { cardStyle: 'landscape' }), text('looks-h', 'A Look is the finish of the app: glass, gloss and bevels, corner shape, type and how closely things are packed. Pages of a book keep their own colours, set in the reader.', 'caption'),
    grid('themes', 'Theme', themeCards, { cardStyle: 'landscape' }), text('themes-h', 'A Theme is colour. Any Look can wear any Theme, including one you import.', 'caption')]
}

function settingsPage(data: Data): Node[] {
  const imported = data.themes.filter((t) => t.imported)
  return [
    list('reading', 'Reading', [row('dict', 'Look up words online', { subtitle: 'Definitions come from dictionaryapi.dev. Only the word you look up is sent, and only when this is on.', icon: 'globe', trailing: data.dictionary ? 'On' : 'Off', action: cmd('reader.dictionary.toggle') })]),
    ...pickers(data),
    stack('theme-import', [button('import-theme', 'Import a theme…', cmd('reader.pick', undefined, { what: 'theme' }), { icon: 'plus' })], { direction: 'row' }),
    text('theme-import-h', 'A theme is a ZIP with theme.json and theme.css, and may hold fonts and pictures. It can set variables only, and can’t reach another site.', 'caption'),
    ...(imported.length ? [list('imported', 'Imported themes', imported.map((t) => row(`i:${t.id}`, t.name, { subtitle: t.description, icon: 'warning', trailing: 'Remove', action: cmd('reader.theme.remove', undefined, { id: t.id }) })))] : []),
    list('storage', 'Storage', [row('store', 'On this device', { subtitle: `Books and notes live in this browser on this device${data.used ? ` (${data.used})` : ''}. Clearing the browser’s site data removes them, so export notes you want to keep.`, icon: 'folder' })]),
    list('about', 'About', [
      row('ver', `WittyReader ${data.version}`, { subtitle: 'Developed by WittyWilla · GNU GPL v3.0 or later', icon: 'info' }),
      row('src', 'Source and licences', { subtitle: 'github.com/wittywilla/WittyReader', icon: 'globe', action: { type: 'external', url: 'https://github.com/wittywilla/WittyReader' } }),
      row('family', 'Part of WittyMediaServer', { subtitle: 'github.com/wittywilla/WittyMediaServer', icon: 'globe', action: { type: 'external', url: 'https://github.com/wittywilla/WittyMediaServer' } }),
    ]),
  ]
}

function welcomePage(data: Data): Node[] {
  return [
    text('hi', 'Welcome to WittyReader. Choose how it looks; you can change this any time in Settings.', 'title'),
    ...pickers(data),
    stack('go', [button('start', 'Start reading', cmd('reader.welcome.done'), { icon: 'book', variant: 'primary' })], { direction: 'row' }),
  ]
}

export const PAGES = ['reader-library', 'reader-book', 'reader-notes', 'reader-import', 'reader-settings', 'reader-welcome'] as const
const INFO: Record<string, { title: string; kind: string; icon: string; route: string }> = {
  'reader-library': { title: 'Library', kind: 'books', icon: 'library', route: '/' },
  'reader-book': { title: 'Book', kind: 'detail', icon: 'book', route: '/book/{item}' },
  // Its search box holds the current search, which a `search` page's box does.
  'reader-notes': { title: 'Notes', kind: 'search', icon: 'list', route: '/notes' },
  'reader-import': { title: 'Import', kind: 'custom', icon: 'download', route: '/import' },
  'reader-settings': { title: 'Settings', kind: 'custom', icon: 'settings', route: '/settings' },
  'reader-welcome': { title: 'Welcome', kind: 'custom', icon: 'sparkles', route: '/welcome' },
}

/** One page, as the server would send it. null when what it was opened for is not there (a book that was removed). */
export function page(id: string, params: URLSearchParams, data: Data, layout: Layout): Document | null {
  const info = INFO[id]
  if (!info) return null
  let kids: Node[] | null
  switch (id) {
    case 'reader-library': kids = library(data, params); break
    case 'reader-book': kids = bookPage(data, params.get('item') || ''); break
    case 'reader-notes': kids = notesPage(data, params); break
    case 'reader-import': kids = importPage(); break
    case 'reader-settings': kids = settingsPage(data); break
    default: kids = welcomePage(data)
  }
  if (!kids) return null
  const title = id === 'reader-book' ? data.books.find((b) => b.key === params.get('item'))?.title || info.title : info.title
  return document({ id, kind: info.kind, title, icon: info.icon, route: info.route, params: Object.fromEntries(params) }, layout, title, kids)
}
export { CATALOG }

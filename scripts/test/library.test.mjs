// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WittyWilla and contributors
// src/library.ts: progress, the shelf, and notes across the library.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { current, filterNotes, notesBackups, notesMarkdown, progress, shelf } from '../../src/library.ts'

const book = (o) => ({ key: o.title, title: 'T', format: 'epub', total: 10, position: 0, added: 1, opened: 0, ...o })

test('progress counts a PDF by pages and a book by words', () => {
  assert.equal(progress(book({ format: 'pdf', total: 10, position: 4, opened: 5 })), 50)
  assert.equal(progress(book({ format: 'epub', total: 2, position: 1, words: [100, 100], opened: 5 })), 50)
  assert.equal(progress(book({ format: 'epub', total: 2, position: 1.99, words: [100, 100], opened: 5 })), 99)
  assert.equal(progress(book({ format: 'epub', total: 2, position: 1.5, words: [100, 900], opened: 5 })), 100) // under two pages' worth left
  assert.equal(progress(book({ position: 0, opened: 0 })), 0)
})

test('the shelf searches, filters and sorts', () => {
  const all = [book({ title: 'Beta', author: 'Zed', added: 3 }), book({ title: 'Alpha', format: 'pdf', added: 1, opened: 9 }), book({ title: 'Gamma', author: 'Amy', format: 'cbz', added: 2 })]
  assert.deepEqual(shelf(all, { sort: 'title' }).map((b) => b.title), ['Alpha', 'Beta', 'Gamma'])
  assert.deepEqual(shelf(all, { sort: 'author' }).map((b) => b.title), ['Gamma', 'Beta', 'Alpha'], 'no author last')
  assert.deepEqual(shelf(all, { sort: 'recent' }).map((b) => b.title), ['Alpha', 'Beta', 'Gamma'])
  assert.deepEqual(shelf(all, { kind: 'cbz' }).map((b) => b.title), ['Gamma'])
  assert.deepEqual(shelf(all, { q: 'amy' }).map((b) => b.title), ['Gamma'])
})

test('the book being read is the latest opened one that is neither new nor finished', () => {
  const a = book({ title: 'A', format: 'pdf', position: 3, opened: 5 }), b = book({ title: 'B', format: 'pdf', position: 9, opened: 9 }), c = book({ title: 'C', format: 'pdf', position: 2, opened: 7 })
  assert.equal(current([a, b, c]).title, 'C')
})

const note = (o) => ({ id: 1, kind: 'highlight', chapter: 0, pos: 0, quote: 'q', prefix: '', suffix: '', color: 'yellow', note: '', created: 1, book: 'k1', bookTitle: 'One', ...o })
test('notes are filtered by book, kind, colour, text and whether they carry a note', () => {
  const all = [note({ id: 1 }), note({ id: 2, kind: 'bookmark', color: '' }), note({ id: 3, book: 'k2', bookTitle: 'Two', color: 'blue', note: 'remember this', quote: 'Blue sky' })]
  assert.deepEqual(filterNotes(all, { book: 'k2' }).map((n) => n.id), [3])
  assert.deepEqual(filterNotes(all, { kind: 'bookmark' }).map((n) => n.id), [2])
  assert.deepEqual(filterNotes(all, { color: 'blue' }).map((n) => n.id), [3])
  assert.deepEqual(filterNotes(all, { q: 'SKY' }).map((n) => n.id), [3])
  assert.deepEqual(filterNotes(all, { withNote: true }).map((n) => n.id), [3])
  assert.equal(filterNotes(all, {}).length, 3)
})

test('notes export as Markdown by book, and as one backup per book in the shape the importer reads', () => {
  const all = [note({ id: 1, quote: 'A line\nwrapped' }), note({ id: 3, book: 'k2', bookTitle: 'Two', author: 'Me', note: 'mine' })]
  const md = notesMarkdown(all)
  assert.match(md, /## One\n\n> A line wrapped/)
  assert.match(md, /## Two \(Me\)\n\n> q\n\nmine/)
  const backups = notesBackups(all)
  assert.equal(backups.length, 2)
  assert.equal(backups[0].app, 'wittyreader')
  assert.equal(backups[0].annotations[0].book, undefined, 'the book field is the backup\'s, not each note\'s')
})

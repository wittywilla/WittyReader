const assert = require('node:assert')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const { test } = require('node:test')
const { booksIn } = require('../opened.js')
const { contentType, resolveAppFile } = require('../serve.js')

const root = path.join(os.tmpdir(), 'wittyreader-root')

test('the app address reaches files inside the folder', () => {
  assert.strictEqual(resolveAppFile(root, '/'), path.join(root, 'index.html'))
  assert.strictEqual(resolveAppFile(root, '/sw.js'), path.join(root, 'sw.js'))
  assert.strictEqual(resolveAppFile(root, '/assets/a%20b.js'), path.join(root, 'assets', 'a b.js'))
})

test('the app address reaches nothing outside the folder', () => {
  for (const bad of ['/..', '/../secret', '/%2e%2e/secret', '/..%2fsecret', '/assets/%2e%2e/%2e%2e/secret', '/..%5csecret', '/a%00b', '/%E0%A4%A', '/%2f%2f']) {
    assert.strictEqual(resolveAppFile(root, bad), null, bad)
  }
})

test('files are served as what they are', () => {
  assert.match(contentType('a.mjs'), /javascript/)
  assert.match(contentType('INDEX.HTML'), /html/)
  assert.strictEqual(contentType('a.unknown'), 'application/octet-stream')
})

test('only real books on a command line count', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wittyreader-books-'))
  try {
    const epub = path.join(dir, 'A Made-Up Book.epub')
    const pdf = path.join(dir, 'Made-Up Paper.PDF')
    fs.writeFileSync(epub, 'x')
    fs.writeFileSync(pdf, 'x')
    fs.writeFileSync(path.join(dir, 'notes.txt'), 'x')
    fs.mkdirSync(path.join(dir, 'folder.cbz'))
    const argv = [
      '--flag', '--inspect=1.2.3.4', 'notes.txt', 'folder.cbz', 'missing.epub', 'https://example.com/book.epub', 'A Made-Up Book.epub',
      pathToFileURL(pdf).href, epub, '', 42, 'x'.repeat(5000) + '.epub',
    ]
    assert.deepStrictEqual(booksIn(argv, dir), [epub, pdf])
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

// Which books a command line names: what the system passes when someone opens a file with the app.
// Everything else on the line is left alone, and only regular files of the kinds it reads count.
const fs = require('fs')
const path = require('path')
const { fileURLToPath } = require('url')

const BOOK = /\.(epub|pdf|cbz)$/i
const TOO_LONG = 4096

function pathFrom(arg, cwd) {
  if (typeof arg !== 'string' || !arg || arg.length > TOO_LONG || arg.startsWith('-')) return ''
  if (/^file:/i.test(arg)) {
    try { return fileURLToPath(arg) } catch { return '' }
  }
  // Anything else with a scheme is an address, and the app opens no addresses.
  if (/^[a-z][a-z0-9+.-]+:/i.test(arg)) return ''
  return path.resolve(cwd, arg)
}

function booksIn(argv, cwd) {
  const found = []
  for (const arg of argv) {
    const file = pathFrom(arg, cwd)
    if (!file || !BOOK.test(file) || found.includes(file)) continue
    try { if (fs.statSync(file).isFile()) found.push(file) } catch { /* it isn't there */ }
  }
  return found
}

module.exports = { booksIn }

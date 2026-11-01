// All the app's pages can do with the desktop app: be told about books opened from the system.
// They get a name and a one-time address, never a path, and can't ask for anything.
const { contextBridge, ipcRenderer } = require('electron')

let consumer = null
const waiting = []

ipcRenderer.on('books-opened', (_event, books) => {
  if (consumer) consumer(books)
  else waiting.push(books)
})

contextBridge.exposeInMainWorld('wittyReaderDesktop', {
  setBookConsumer(fn) {
    consumer = fn
    while (waiting.length) fn(waiting.shift())
  },
})

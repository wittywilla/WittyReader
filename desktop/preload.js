// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WittyWilla and contributors
// All the app's pages can do with the desktop app: be told about books opened from the system,
// say which colour the window should be behind them, and add or remove a server they may call.
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
  // The window's colour behind the page, to match the chosen theme.
  setBackground(colour) {
    if (typeof colour === 'string') ipcRenderer.send('background', colour)
  },
  // The servers the reader has added: the origins the page's policy lets it call. Adding or removing one reloads the page.
  servers: () => ipcRenderer.invoke('servers:list'),
  addServer: (address, hash) => ipcRenderer.invoke('servers:add', String(address), typeof hash === 'string' ? hash : undefined),
  removeServer: (address) => ipcRenderer.invoke('servers:remove', String(address)),
})

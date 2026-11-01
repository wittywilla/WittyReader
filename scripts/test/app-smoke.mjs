#!/usr/bin/env node
// Looks inside the running app through Chromium's debugging port, which the test started it with.
// Checks that it opened, that it can do what it's for, and that its page can't do anything else.
//
//   node app-smoke.mjs <port> first <screenshot.png>   the first start, given an EPUB on its command line
//   node app-smoke.mjs <port> count <n>                waits until the library holds n books
//   node app-smoke.mjs <port> again <n> <screenshot>   a later start: n books, shown by the service worker
//
// Needs Node 22 or newer for its built-in WebSocket.
import { writeFileSync } from 'node:fs'

const [port, step, arg, shot] = process.argv.slice(2)
const fail = (why) => { console.error(`FAIL: ${why}`); process.exit(1) }
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const expect = (what, got, want) => {
  console.log(`${what}: ${JSON.stringify(got)}`)
  if (JSON.stringify(got) !== JSON.stringify(want)) fail(`${what}: wanted ${JSON.stringify(want)}`)
}

async function appPage() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
      const page = list.find((t) => t.type === 'page' && t.url.startsWith('wittyreader://app/'))
      if (page) return page
    } catch { /* not up yet */ }
    await sleep(1000)
  }
  fail('the app never showed its page on the debugging port')
}

function connect(url) {
  const ws = new WebSocket(url)
  let next = 1
  const waiting = new Map()
  ws.onmessage = (m) => {
    const data = JSON.parse(m.data)
    if (data.id && waiting.has(data.id)) { waiting.get(data.id)(data); waiting.delete(data.id) }
  }
  return new Promise((resolve) => {
    ws.onopen = () => resolve({
      send: (method, params = {}) => new Promise((done) => {
        const id = next++
        waiting.set(id, done)
        ws.send(JSON.stringify({ id, method, params }))
      }),
      eval: async function (expression) {
        const r = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
        if (r.result.exceptionDetails) fail(`evaluating ${expression}: ${JSON.stringify(r.result.exceptionDetails)}`)
        return r.result.result.value
      },
      close: () => ws.close(),
    })
  })
}

const page = await connect((await appPage()).webSocketDebuggerUrl)
const until = async (what, expression, tries = 60) => {
  for (let i = 0; i < tries; i++) {
    if (await page.eval(expression)) return
    await sleep(500)
  }
  fail(`never happened: ${what}`)
}
const LIBRARY = `new Promise((done, bad) => { const r = indexedDB.open('wittyreader', 1);
  r.onerror = () => bad(r.error);
  r.onsuccess = () => { const t = r.result.transaction('books').objectStore('books').getAll();
    t.onsuccess = () => { r.result.close(); done(t.result.map((b) => [b.format, b.title, b.author || ''])) } } })`
const library = () => page.eval(LIBRARY)
const until_books = async (n) => {
  for (let i = 0; i < 60; i++) {
    const books = await library().catch(() => [])
    if (books.length >= n) return books
    await sleep(500)
  }
  fail(`the library never reached ${n} books: ${JSON.stringify(await library())}`)
}

async function screenshot(file) {
  if (!file) return
  const r = await page.send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(file, Buffer.from(r.result.data, 'base64'))
}

await until('the page loading', 'document.readyState === "complete"')

if (step === 'first') {
  expect('address', await page.eval('location.href.split("#")[0]'), 'wittyreader://app/')
  expect('title', await page.eval('document.title'), 'WittyReader')
  expect('a secure context', await page.eval('isSecureContext'), true)
  expect('what the page can reach of Node', await page.eval('[typeof require, typeof process, typeof module].join()'), 'undefined,undefined,undefined')
  expect('what the desktop app gives the page', await page.eval('Object.keys(window.wittyReaderDesktop)'), ['setBookConsumer'])
  const csp = await page.eval(`document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content || ''`)
  console.log(`the app's security policy: ${csp}`)
  if (!csp.includes("script-src 'self'")) fail("the app's own security policy is missing")
  await until('the service worker', 'navigator.serviceWorker.ready.then((r) => r.scope === "wittyreader://app/")')
  console.log('the service worker is running')

  console.log('\nthe EPUB named on the command line')
  const books = await until_books(1)
  expect('library', books, [['epub', 'A Made-Up Book', 'A Made-Up Author']])
  await until('the book opening', `caches.has('wittyreader-book')`)
  await until('the book being ready', `caches.open('wittyreader-book').then((c) => c.keys()).then((k) => k.length > 0)`)
  const chapter = await page.eval(`caches.open('wittyreader-book').then((c) => c.keys()).then((k) => k.find((r) => r.url.endsWith('one.xhtml')).url).then((u) => fetch(u)).then(async (r) => [r.status, r.headers.get('content-security-policy') || '', await r.text()])`)
  console.log(`a chapter, through the service worker: ${chapter[0]}, with the policy ${chapter[1].slice(0, 60)}...`)
  if (chapter[0] !== 200 || !chapter[2].includes('written for a test')) fail('the service worker did not serve the chapter')
  if (!chapter[1]) fail('a book file came with no security policy')
  await until('the reader showing', `document.querySelector('iframe') !== null`)
  await sleep(1500)
  const frame = await page.eval(`document.querySelector('iframe').getAttribute('sandbox')`)
  console.log(`the book's frame is sandboxed with: ${JSON.stringify(frame)}`)
  await screenshot(shot)

  console.log('\nwhat it should refuse')
  expect('an address outside the app', await page.eval(`fetch('https://example.com/').then(() => 'reached', () => 'refused')`), 'refused')
  const traversal = `['..%2f..%2fetc%2fpasswd', '%2e%2e/%2e%2e/%2e%2e/etc/passwd', '..%5c..%5cpackage.json', '__opened__/not-a-real-one', 'main.js', 'no-such-file']`
  expect('addresses outside its files', await page.eval(`Promise.all(${traversal}.map((p) => fetch('wittyreader://app/' + p).then((r) => r.status, () => 0)))`), [404, 404, 404, 404, 404, 404])
  expect('another host on its own scheme', await page.eval(`fetch('wittyreader://elsewhere/index.html').then((r) => r.status, () => 0)`), 0)
  expect('a new window', await page.eval(`window.open('about:blank') === null`), true)
  await page.eval(`location.href = 'https://example.com/'; 1`)
  await sleep(1500)
  expect('after being told to go elsewhere', await page.eval('location.origin'), 'wittyreader://app')
  await until('still running', 'document.readyState === "complete"')
  expect('notifications', await page.eval(`Notification.requestPermission()`), 'denied')
  expect('the microphone', await page.eval(`navigator.mediaDevices?.getUserMedia ? navigator.mediaDevices.getUserMedia({ audio: true }).then(() => 'given', () => 'refused') : 'refused'`), 'refused')
  expect('location', await page.eval(`new Promise((done) => navigator.geolocation.getCurrentPosition(() => done('given'), () => done('refused'), { timeout: 3000 }))`), 'refused')
  console.log(`copying to the clipboard's permission: ${await page.eval(`navigator.permissions.query({ name: 'clipboard-write' }).then((p) => p.state)`)}`)
  console.log(`storage kept when space runs low: ${await page.eval('navigator.storage.persist()')}`)
}

if (step === 'count') {
  const books = await until_books(Number(arg))
  console.log(`library: ${JSON.stringify(books)}`)
}

if (step === 'again') {
  await until('the service worker controlling the page', 'navigator.serviceWorker.controller !== null')
  expect('the page is shown', await page.eval(`document.querySelector('.wr') !== null`), true)
  const books = await until_books(Number(arg))
  console.log(`library after starting again: ${JSON.stringify(books)}`)
  await until('its shelf', `document.body.innerText.includes('A Made-Up Book')`)
  expect('a file through the service worker', await page.eval(`fetch('icon.svg').then((r) => r.status)`), 200)
  await screenshot(shot)
}

page.close()
console.log('OPENED')

// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WittyWilla and contributors
const assert = require('node:assert')
const { test } = require('node:test')
const { allowedRequest, cleanList, MAX_SERVERS, originOf, rewriteHtml, withServers } = require('../origins.js')
const vectors = require('./origin-vectors.json')

test('an address is turned into an origin', () => { for (const [input, want] of vectors.ok) assert.strictEqual(originOf(input), want, input) })
test('anything that is not a plain http or https origin is refused', () => { for (const bad of vectors.bad) assert.strictEqual(originOf(bad), null, JSON.stringify(bad)) })

test('a list keeps valid origins once each, and at most eight', () => {
  assert.deepStrictEqual(cleanList(['a.test:1', 'http://a.test:1/', '*', 'https://b.test', 5, null]), ['http://a.test:1', 'https://b.test'])
  assert.strictEqual(cleanList(Array.from({ length: 20 }, (_, i) => `s${i}.test`)).length, MAX_SERVERS)
  assert.deepStrictEqual(cleanList('http://a.test'), [])
})

const policy = "default-src 'self'; script-src 'self'; img-src 'self' blob: data:; connect-src 'self' blob: data: https://api.dictionaryapi.dev; object-src 'none'"
test('the servers go into connect-src and img-src and nowhere else', () => {
  const out = withServers(policy, ['192.168.1.20:9797', 'https://media.test'])
  assert.match(out, /img-src 'self' blob: data: http:\/\/192\.168\.1\.20:9797 https:\/\/media\.test;/)
  assert.match(out, /connect-src 'self' blob: data: https:\/\/api\.dictionaryapi\.dev http:\/\/192\.168\.1\.20:9797 https:\/\/media\.test;/)
  assert.match(out, /script-src 'self';/); assert.match(out, /default-src 'self';/); assert.match(out, /object-src 'none'/)
  assert.ok(!/ \*|http: |https: |https:;|http:;/.test(out.replace(/https?:\/\/[^\s;]+/g, '')), 'no wildcard and no bare scheme')
  assert.strictEqual(withServers(policy, []), policy, 'no servers: the policy as built')
  assert.strictEqual(withServers(policy, ['*', 'ftp://x', 'http://u@x.test']), policy, 'what is not an origin adds nothing')
})
test('the page is rewritten through its meta tag only', () => {
  const html = `<head><meta http-equiv="Content-Security-Policy" content="${policy}"><title>x</title></head>`
  assert.match(rewriteHtml(html, ['https://media.test']), /connect-src 'self' blob: data: https:\/\/api\.dictionaryapi\.dev https:\/\/media\.test;/)
  assert.strictEqual(rewriteHtml('<head></head>', ['https://media.test']), '<head></head>')
})
test('a request is allowed to the dictionary and to an added server, and to nothing else', () => {
  const dict = 'https://api.dictionaryapi.dev/'
  const servers = ['http://192.168.1.20:9797']
  assert.ok(allowedRequest('https://api.dictionaryapi.dev/api/v2/entries/en/word', dict, servers))
  assert.ok(allowedRequest('http://192.168.1.20:9797/api/v1/sdui/pages/home?x=1', dict, servers))
  for (const no of ['http://192.168.1.20:9798/', 'http://192.168.1.21:9797/', 'https://192.168.1.20:9797/', 'http://192.168.1.20:9797.evil.test/', 'http://evil.test/http://192.168.1.20:9797/', 'ws://192.168.1.20:9797/', 'nonsense']) assert.ok(!allowedRequest(no, dict, servers), no)
})

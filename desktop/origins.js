// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WittyWilla and contributors
// The servers a person has added, as the addresses the app's page may call. The built page's policy allows only its own address and
// the dictionary; the desktop app adds exactly the servers the person has added (an origin each, never a wildcard, never "http:" or
// "https:" alone) to `connect-src` and `img-src` of the page it serves. Nothing here needs Electron, so it is tested alone.
const MAX_SERVERS = 8

// An address as an origin ("http://192.168.1.20:9797"), or null. A scheme is optional (http is meant); only http and https; a host
// with an optional port; no sign-in (userinfo), no path beyond "/", no query, no fragment, no wildcard, no spaces or quotes.
function originOf(input) {
  if (typeof input !== 'string') return null
  const text = input.trim()
  if (!text || text.length > 200 || /[\s"'<>`\\*;,|]/.test(text)) return null
  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(text)
  // Without a scheme it has to be a host with an optional port (so "http:" is not read as a host called http).
  if (!hasScheme && !/^(\[[0-9a-f:.]+\]|[a-z0-9.-]+)(:\d{1,5})?\/?$/i.test(text)) return null
  const withScheme = hasScheme ? text : 'http://' + text
  let u
  try { u = new URL(withScheme) } catch { return null }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
  if (u.username || u.password || !u.hostname) return null
  if (u.search || u.hash || (u.pathname !== '/' && u.pathname !== '')) return null
  if (/^\/\/[^/]*[?#]/.test(withScheme.replace(/^[a-z]+:/i, '')) || withScheme.includes('?') || withScheme.includes('#') || withScheme.includes('@')) return null
  if (u.hostname.includes('%') || u.hostname.startsWith('.') || u.hostname.endsWith('.')) return null
  return u.origin
}

// A list as it may be kept: valid origins, once each, at most MAX_SERVERS.
function cleanList(list) {
  const out = []
  for (const item of Array.isArray(list) ? list : []) {
    const o = originOf(item)
    if (o && !out.includes(o) && out.length < MAX_SERVERS) out.push(o)
  }
  return out
}

// The page's policy with the servers added to connect-src and img-src, and to no other directive.
function withServers(policy, servers) {
  const list = cleanList(servers)
  if (!list.length) return policy
  const add = (p, directive) => p.replace(new RegExp(`(${directive} )([^;]*)`), (_m, d, values) => `${d}${values} ${list.join(' ')}`)
  return add(add(policy, 'connect-src'), 'img-src')
}

// An index.html with the policy in its meta tag rewritten, or the page as it was if it has none.
function rewriteHtml(html, servers) {
  return html.replace(/(<meta http-equiv="Content-Security-Policy" content=")([^"]*)(")/, (_m, a, policy, b) => a + withServers(policy, servers) + b)
}

// Whether a request is to an address the page may reach: the dictionary, or one of the servers' origins.
function allowedRequest(url, dictionary, servers) {
  if (url.startsWith(dictionary)) return true
  let u
  try { u = new URL(url) } catch { return false }
  return cleanList(servers).includes(u.origin)
}

module.exports = { MAX_SERVERS, originOf, cleanList, withServers, rewriteHtml, allowedRequest }

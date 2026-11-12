// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WittyWilla and contributors
// A seam of the app: the server's renderer imports `Link` from react-router-dom; a standalone
// reader has no router library, so react-router-dom is aliased to this (vite.config.ts and
// tsconfig.json). Addresses live in the URL's hash (`#/book/abc`), which works the same in a
// browser, an installed app and the desktop app's local server, and Back and Forward step through them.
import { forwardRef, useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent } from 'react'

const listeners = new Set<() => void>()
const read = () => {
  const h = location.hash.replace(/^#/, '') || '/'
  const q = h.indexOf('?')
  return q < 0 ? { pathname: h, search: '' } : { pathname: h.slice(0, q), search: h.slice(q) }
}
let snapshot = read()
const refresh = () => { const next = read(); if (next.pathname !== snapshot.pathname || next.search !== snapshot.search) { snapshot = next; listeners.forEach((l) => l()) } }
if (typeof window !== 'undefined') window.addEventListener('hashchange', refresh)

export type Location = { pathname: string; search: string }
export const useLocation = (): Location => useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l) } }, () => snapshot)
export const currentLocation = (): Location => { refresh(); return snapshot }

/** Goes to an address of the app; `replace` swaps the current history entry. */
export function navigate(to: string, replace = false) {
  const url = location.pathname + location.search + '#' + to
  if (replace) history.replaceState(history.state, '', url); else history.pushState({ wr: 1 }, '', url)
  refresh()
}
export const useNavigate = () => navigate
/** Whether the entry before this one is a place in the app (it was reached by `navigate`), so Back stays inside it. */
export const canGoBack = () => (history.state as { wr?: number } | null)?.wr === 1

export type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { to: string; replace?: boolean }
export const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link({ to, replace, onClick, ...rest }, ref) {
  const go = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e)
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || rest.target === '_blank') return
    e.preventDefault()
    navigate(to, replace)
  }
  return <a {...rest} ref={ref} href={'#' + to} onClick={go} />
})

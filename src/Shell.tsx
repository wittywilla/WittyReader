// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 WittyWilla and contributors
import { useState, type ReactNode } from 'react'
import { IconSearch } from './web/icons'
import { Link, navigate, useLocation } from './web/router'
import { sduiIcon } from './web/sdui/render/icons'
import type { Navigation } from './web/sdui/types.ts'

// The app's frame, drawn from a Navigation document (SDUI has no shell component: each app draws its own).
// The wordmark's second word follows the theme's brand colour (--brand-accent); the server-name concept
// (a custom coloured name, a mark) is the server's and doesn't apply to a standalone app.
export function Shell({ navigation, addBooks, children }: { navigation: Navigation; addBooks: () => void; children: ReactNode }) {
  const loc = useLocation()
  const q = loc.pathname === '/search' ? new URLSearchParams(loc.search).get('q') || '' : ''
  const [text, setText] = useState(q)
  const here = (route: string) => (route === '/' ? loc.pathname === '/' || loc.pathname === '/search' || loc.pathname.startsWith('/book/') : loc.pathname.startsWith(route))
  return (
    <div className="wr">
      <header className="wr-top">
        <Link to="/" className="wr-brand" aria-label="WittyReader, library"><img src="icon.svg" alt="" width={30} height={30} /><span className="wr-word"><b>Witty</b>Reader</span></Link>
        <nav className="wr-tabs" aria-label="Pages">
          {navigation.items.map((i) => <Link key={i.id} to={i.route} aria-current={here(i.route) ? 'page' : undefined}>{sduiIcon(i.icon)}{i.label}</Link>)}
        </nav>
        <span className="grow" />
        <form className="wr-search" role="search" onSubmit={(e) => { e.preventDefault(); navigate(text.trim() ? '/search?q=' + encodeURIComponent(text.trim()) : '/', loc.pathname === '/search') }}>
          <IconSearch size={18} />
          <input type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder="Search your library" aria-label="Search your library" />
        </form>
        <button className="btn primary" onClick={addBooks} title="Add books (Ctrl+O)">{sduiIcon('plus')}<span className="wr-hide-sm">Add books</span></button>
      </header>
      <main className="wr-main">{children}</main>
    </div>
  )
}

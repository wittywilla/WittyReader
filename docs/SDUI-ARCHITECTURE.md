# WittyReader: screens as SDUI, and the server's themes

Decision of 2026-11-12 (W17, Design 2). Status of each part is in the last section; read that first when
you want to know what exists.

## The decision

WittyReader draws its library, book page, notes list, import and settings as **server-driven UI documents**, with the
**server's own renderer**, even though there is no server. Three pieces:

1. **A page provider** (`src/pages/`): a local module that turns the app's own data (the books and notes in
   IndexedDB, the settings in localStorage) into SDUI `Document`s of catalogue revision 7: the same JSON the server sends
   (`docs/SDUI.md` in WittyMediaServer). It also answers a section's further items, and carries out a page's *commands*
   (remove a book, export notes, choose a theme) the way the server answers `command` actions: as requests to a
   small local API table. A provider is an interface (`page`, `items`, `request`, `navigation`), so the local provider
   and a remote one (the same calls over `/api/v1/sdui/...`) are interchangeable.
2. **The server's renderer, copied, not forked** (`src/web/`, written by `scripts/sync-web.mjs`). The renderer
   (`web/src/sdui/model.ts`, `render/components.tsx`, `DockView`, markdown, widgets, the `ui/` controls they use, the
   design system's `styles.css`, `design2.css`, `finish.css`, `ui/ui.css`, `sdui/sdui.css`) is copied byte for byte, with
   a SHA-256 of every file in `src/web/SYNC.json`. A test fails when a copy differs from its hash (someone edited it) or,
   with a server checkout beside the repository, from the server's file (the server moved on: run the script).
   The renderer imports a handful of app modules (`api`, `state`, `audio/player`, `shell/useNav`, `components/common`,
   `react-router-dom`); the app supplies small **seams** at those paths in `src/web/` (not listed in `SYNC.json`), so
   the copied files never change. This is the same model as WittyModule's `kit/sync-sdui-core.sh`.
3. **The reading surface stays native.** `/read/{book}` is a native screen in the route table (`native: reader`):
   WittyEbook, WittyPDF and WittyComics (the S8 modules, not touched here) draw the book. Their menus read the same
   CSS variables the themes set.

When the reader is **connected to a server** the provider changes, not the renderer: a remote provider asks
`GET /sdui/pages/{page}` with the device headers, and the server's pages (its books library) come back as documents
of the same shape; the local pages (Notes, Import, Settings) stay local, merged into the navigation as a module's
pages are. The remote provider is designed (the interface has the calls) and **not built** in this change.

## Why not the alternatives

| Option | Why not |
|---|---|
| A shared npm package of the renderer, published from the server's `web/` | The right end state, but the renderer imports the web app's router, state, API and 15 000 lines of app through them; extracting it means refactoring `web/` while W2 and the design workstreams are changing it. Doing it now forks or destabilises the server. The seams list above is exactly the work that extraction would have to do, so the vendored build keeps that list small and visible, and a later extraction replaces the sync script without touching the app. |
| A hand-written second renderer for the reader | Forks the design: every catalogue change would be built twice. The owner's requirement is the same SDUI. |
| Native screens drawn with the reader's own CSS, "inspired by" SDUI | Not SDUI. This is what the reader had before. |
| A git submodule of the server | The reader builds without the server (the sync script's output is committed, like `sync-themes.mjs` before it). |

## Navigation and the shell

SDUI has no shell component: each app draws its own frame from the `Navigation` document. The reader's frame
(`src/Shell.tsx`, the app's own) is a top bar with the wordmark, the navigation items (Library, Notes, Import,
Settings) and search, drawn from a `Navigation` the provider makes. The wordmark follows the app's name colours;
the server-name concept (custom coloured server name, mark) does not apply to a standalone app.

## Pages (`src/pages/`)

| Page id | Kind | Route | What it has |
|---|---|---|---|
| `reader-library` | `books` | `/` | Continue-reading `Hero`-less row (`Shelf`, `progress`-style book cards), a `FilterBar`-like set of kind chips and sort as `Dock` controls, a `Grid` of `book` cards, an empty-state `Banner` with the Add books button |
| `reader-book` | `detail` | `/book/{item}` | `DetailHeader`-style header (cover, title, author, facts, Read and Continue, Export notes, Remove), the book's notes as a `List` |
| `reader-notes` | `custom` | `/notes` | Every highlight and note across books, filtered by book, kind and colour with `Tabs`, a search box, Export (JSON, Markdown) |
| `reader-import` | `custom` | `/import` | Add books (EPUB, PDF, CBZ), import notes, drop zone text |
| `reader-settings` | `custom` | `/settings` | Reading (online dictionary), Look, Theme, import a theme, storage, About |

Commands the pages carry: `reader.remove`, `reader.export`, `reader.dictionary`, `reader.theme.set`, `reader.look.set`,
`reader.pick` (opens the system file picker for books, notes or a theme). They are registered with the renderer's
`setCommandSpecs`, so `routes.plan` turns them into `request` steps the local provider answers.

Documents are checked in tests against the catalogue (`src/web/catalog.json`, the module kit's copy): known
components, icons, card styles and action types; unique node ids; exactly one default focus.

## Themes (second step)

* The reader ships the **15 built-in themes** as the server does: `public/themes/<id>/theme.json` and `theme.css`,
  copied by the sync script, with `themes/index.json` for the picker. `src/web/tokens.json` holds the design
  tokens; `src/web/experiences.json` the fourteen looks.
* **Look and Theme are two choices**, as on the server: the Look (an experience: glass/gloss/bevel/glow/texture
  effects, shape multiple, type set, density, focus style) and the Theme (colours and scene). Each Look has a default
  Theme; any Look wears any Theme. The reader's Look changes finish, shape, type and density; its layout is always
  its own top bar (the layouts of rail, bottom tabs and so on are the server UI's).
* **Wearing the finish:** the engine (`src/theme/`) sets the same `data-fx-*`, `data-type`, `data-card-set`,
  `data-focus-style`, `--shape-mult`, `--glass-*`, `--gloss-*` on `<html>` that `web/src/theme.ts` does, from the
  Look's effects and the theme's `finish`, and `finish.css` (copied) draws them. The scene is drawn by the copied
  `ui/Scene.tsx`.
* **First run** offers the Look and Theme once (`wittyreader.firstRun`), with "Match this device" first.
* **Theme import**: a ZIP of `theme.json`, `theme.css` and assets, by the server's rules (`docs/THEMES.md`): at most
  25 MB, 10 MB a file, 200 files; plain relative names; only `css json png jpg jpeg webp gif avif svg woff2 woff ttf
  otf txt md`; `theme.css` is `:root` variables and `@font-face` only, and no `http:`, `https:` or `//`;
  `builtin: true` is refused. Fonts load through `FontFace` from the ZIP; colours are set through the CSSOM
  (the app's content security policy forbids a `<style>` made at run time). Imported scene *image* layers are not drawn
  (the renderer asks a server for them) and are listed as a known limit.
* **The reader's own reading colours** (page, sepia, night) stay inside the reader plugins, separate from the app theme.

## Connecting to a server: only servers the person adds

The built app's content security policy stays strict: scripts, styles and images from itself, and `connect-src` for itself and the dictionary
(off until turned on). **A server can be called only after the person adds it** (Settings, Connect to a server: its address, then secure
pairing), and then exactly that origin, nothing broader.

- **Address rules** (`originOf`, in `src/pages/connection.ts` and again in `desktop/origins.js`, both tested with the same vectors,
  `desktop/test/origin-vectors.json`): `http` or `https` only (a bare `host:port` means http), a host and an optional port, no sign-in in it
  (userinfo), no path, query or fragment, no wildcard, no spaces, quotes, semicolons or commas. At most eight servers.
- **Desktop app** (the one build that can add servers): the page asks over the preload bridge (`servers`, `addServer`, `removeServer`); the
  main process validates the origin itself (never trusting the page), keeps the list in its own folder (`servers.json`), and
  - serves `index.html` with the origins appended to the `connect-src` and `img-src` of its policy `<meta>` (`rewriteHtml`; no other
    directive changes; no servers means the policy as built), and
  - allows requests to the dictionary and those origins only in the session's request filter (`allowedRequest`).
  The policy is read once per page, so adding or removing a server reloads the page; an added server carries on to pairing, a removed one
  loses its sign-in and its origin at once.
- **Plain web build**: the page can't change its own policy, so the Connect page says connecting needs the desktop app (or a web host that
  serves WittyReader with a `Content-Security-Policy` header naming the server) and offers no way to add one.
- **Signing in** is secure pairing (CLIENT-API.md): the address is the only thing typed, the app shows a PIN and a QR code, someone signed in
  elsewhere approves, and the token comes back once and is kept per server. Settings lists the servers with Use and Remove (Remove
  signs the device out of it and takes its origin away).
- Pages of the server in use come from `src/pages/remote.ts` under `/s`; the app's own pages stay local.

## Status

See `HANDOVER-0.8.0.md`, "W17: WittyReader", for built and not built.

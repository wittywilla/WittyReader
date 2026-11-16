# WittyReader: screens as SDUI, and the server's themes

How WittyReader draws its screens. The reading surface is the reader modules' own; everything around it is a server-driven
page, made on the device.

## The idea

WittyReader draws its library, shelf, book page, notes list, import, settings, connection and welcome pages as
**server-driven UI documents**, with the **server's own renderer**, even though there is usually no server. Three pieces:

1. **A page provider** (`src/pages/`): a local module that turns the app's own data (the books and notes in
   IndexedDB, the settings in localStorage) into SDUI `Document`s of the catalogue in `src/web/catalog.json` (revision 8):
   the same JSON the server sends (`docs/SDUI.md` in WittyMediaServer). It also answers a section's further items, and
   carries out a page's *commands* (remove a book, export notes, choose a theme) the way the server answers `command`
   actions: as requests to a small local API table. A provider is an interface (`page`, `items`, `request`,
   `navigation`), so the local provider (`local.ts`) and the remote one (`remote.ts`, the same calls over
   `/api/v1/sdui/...`) are interchangeable.
2. **The server's renderer, copied, not forked** (`src/web/`, written by `scripts/sync-web.mjs`). The renderer
   (`web/src/sdui/model.ts`, `render/components.tsx`, `DockView`, markdown, widgets, the `ui/` controls they use, the
   design system's `styles.css`, `design2.css`, `finish.css`, `ui/ui.css`, `sdui/sdui.css`) is copied byte for byte, with
   a SHA-256 of every file in `src/web/SYNC.json`. A test fails when a copy differs from its hash (someone edited it) or,
   with a server checkout beside the repository, from the server's file (the server moved on: run the script).
   The renderer imports a handful of app modules (`api`, `state`, `audio/player`, `shell/useNav`, `components/common`,
   `react-router-dom`); the app supplies small **seams** at those paths in `src/web/` (not listed in `SYNC.json`), so
   the copied files never change. This is the same model as WittyModule's `kit/sync-sdui-core.sh`.
3. **The reading surface stays native.** `/read/{item}` is a native screen in the route table (`native: reader`):
   WittyEbook, WittyPDF and WittyComics draw the book. Their menus read the same CSS variables the themes set.

When the reader is **connected to a server** the provider changes, not the renderer: the remote provider asks
`GET /api/v1/sdui/pages/{page}` with the device headers, and the server's pages come back as documents of the same
shape, under `/s` in the app. The app's own pages (Notes, Import, Settings, Welcome) stay local, merged into the
navigation as a module's pages are.

## Why not the alternatives

| Option | Why not |
|---|---|
| A shared npm package of the renderer, published from the server's `web/` | The renderer imports the web app's router, state and API, and a lot of the app through them; extracting it means refactoring the server's `web/`. The seams list above is exactly the work that extraction would have to do, so the copied build keeps that list small and visible, and a later extraction can replace the sync script without touching the app. |
| A hand-written second renderer for the reader | Forks the design: every catalogue change would be built twice. |
| Native screens drawn with the reader's own CSS, "inspired by" SDUI | Not SDUI, and what the reader had before. |
| A git submodule of the server | The reader builds without the server (the sync script's output is committed). |

## Navigation and the shell

SDUI has no shell component: each app draws its own frame from the `Navigation` document. The reader's frame
(`src/Shell.tsx`, the app's own) is a top bar with the wordmark, the navigation items (Library, Shelf, Notes, Import,
Server while one is connected, Settings), search and **Add books**, drawn from a `Navigation` the provider makes. The
wordmark follows the theme's brand colour; the server-name concept (custom coloured server name, mark) does not apply
to a standalone app.

## Pages (`src/pages/local.ts`)

| Page id | Kind | Route | What it has |
|---|---|---|---|
| `reader-library` | `books` | `/`, `/search` | Continue reading (a `Shelf` of one book card with progress), a `FilterBar` (kind and sort), a `Grid` of `book` cards, and an empty-state `Banner` with Add books |
| `reader-shelf` | `books` | `/shelf` | WittyInk's bookshelf (`wittyink.bookshelf`) as a `NativeView`: books, series and authors |
| `reader-book` | `detail` | `/book/{item}` | A `DetailHeader` (cover, title, author, facts, Read or Continue reading, Export notes, Remove), the book's notes as a `List` |
| `reader-notes` | `search` | `/notes` | Every highlight, bookmark and drawing across books, with a `FilterBar` (book, type, colour, only with a note) and search, and Export as Markdown or as backup (JSON) |
| `reader-import` | `custom` | `/import` | Add books (EPUB, PDF, CBZ), import notes |
| `reader-settings` | `custom` | `/settings` | Reading (online dictionary), Servers, the reader modules' own settings, Look, Theme, import a theme, imported themes, storage, About |
| `reader-connect` | `custom` | `/connect` | The servers added, with Use and Remove; adding one by its address; the PIN and QR code while pairing |
| `reader-welcome` | `custom` | `/welcome` | The first start: Look and Theme, then Start reading |

Commands the pages carry: `reader.pick` (opens the system file picker for books, notes or a theme), `reader.remove`,
`reader.export`, `reader.notes.export`, `reader.dictionary.toggle`, `reader.setting.set`, `reader.look.set`,
`reader.theme.set`, `reader.theme.remove`, `reader.connect.start`, `reader.connect.cancel`, `reader.server.use`,
`reader.server.remove` and `reader.welcome.done`. They are registered with the renderer's `setCommandSpecs`, so
`routes.plan` turns them into `request` steps the local provider answers.

Documents are checked in tests against the catalogue (`src/web/catalog.json`, the module kit's copy): known
components, icons, card styles and action types; unique node ids; exactly one default focus.

The readers' settings in Settings are the `settings` of each reader module's `sdui.json` (WittyInk, WittyEbook, WittyPDF,
WittyComics), copied into `src/modules/settings.json` by `scripts/sync-modules.mjs`: the same keys and values a
server profile keeps, which the readers ask for as `ReaderHost.settings`.

## Themes

* The reader ships the **15 built-in themes** as the server does: `public/themes/<id>/theme.json` and `theme.css`,
  copied by the sync script, with `themes/index.json` for the picker. `src/web/tokens.json` holds the design
  tokens; `src/web/experiences.json` the fourteen Looks.
* **Look and Theme are two choices**, as on the server: the Look (an experience: glass/gloss/bevel/glow/texture
  effects, shape multiple, type set, density, focus style) and the Theme (colours and scene). Each Look has a default
  Theme; any Look wears any Theme. The reader's Look changes finish, shape, type and density; its layout is always
  its own top bar (the layouts of rail, bottom tabs and so on are the server UI's).
* **Wearing the finish:** the engine (`src/theme/`) sets the same `data-fx-*`, `data-type`, `data-card-set`,
  `data-focus-style`, `--shape-mult`, `--glass-*`, `--gloss-*` on `<html>` that the server's `web/src/theme.ts` does,
  from the Look's effects and the theme's `finish`, and `finish.css` (copied) draws them. The scene is drawn by the copied
  `ui/Scene.tsx`.
* **First run** offers the Look and Theme once (the welcome page), with "Match this device" first.
* **Theme import**: a ZIP of `theme.json`, `theme.css` and assets, by the server's rules (`docs/THEMES.md`): at most
  25 MB, 10 MB a file, 200 files; plain relative names; only `css json png jpg jpeg webp gif avif svg woff2 woff ttf
  otf txt md`; `theme.css` is `:root` variables and `@font-face` only, and no `http:`, `https:` or `//`;
  `builtin: true` is refused. Fonts load through `FontFace` from the ZIP; colours are set through the CSSOM
  (the app's content security policy forbids a `<style>` made at run time). Imported scene *image* layers are not drawn
  (the renderer asks a server for them).
* **The reader's own reading colours** (page, sepia, night) stay inside the reader modules, separate from the app theme.

## Connecting to a server: only servers the person adds

The built app's content security policy stays strict: scripts, styles and images from itself, and `connect-src` for itself and the dictionary
(off until turned on). **A server can be called only after the person adds it** (Settings, Servers: its address, then secure
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
- **Signing in** is secure pairing (the server's `docs/CLIENT-API.md`): the address is the only thing typed, the app shows a PIN and a QR
  code, someone signed in elsewhere approves, and the token comes back once and is kept per server. Settings lists the servers with Use and
  Remove (Remove signs the device out of it and takes its origin away).
- Pages of the server in use come from `src/pages/remote.ts` under `/s`; the app's own pages stay local.

## Known limits

- Imported themes' scene image layers are not drawn.
- The web build can't add servers (see above).

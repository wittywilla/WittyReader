# Hosting and building

WittyReader is a static web app: a folder of files, with no server-side code.

## Build it

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
git clone https://github.com/wittywilla/WittyReader.git
cd WittyReader
npm install
npm run build
```

The finished app is in `dist/`. `npm run dev` starts a development copy at
`http://localhost:5180`.

## The installers

In `desktop/`, which wraps the same built files in a window of their own:

```bash
npm ci --ignore-scripts
npm run package:win      # or package:linux, package:mac
```

They go in `desktop/out/`. Nothing is code-signed yet: `identity` and `hardenedRuntime` under `mac` in `desktop/package.json` make the
stand-in signature that Apple silicon needs, and come out when there's a real certificate. Windows needs building on Windows, and `.dmg` on a Mac. `.rpm` needs the `rpm` tool.
`scripts/test/installers-linux.sh` and `scripts/test/installers-wine.sh` run them for real in throwaway containers, and compare the
file system and registry from before and after. `scripts/test/mac-uninstaller.sh` checks the Mac uninstaller's logic.

## Host it

Put the contents of `dist/` on any web server or static host (a NAS's web server, nginx, Caddy,
GitHub Pages, Netlify…). Notes:

- **It must be served over https**, or from `localhost`. Browsers only allow the parts
  WittyReader needs (the service worker that shows EPUBs and works offline, and secure hashing)
  on secure addresses. Opening `index.html` straight from the disk won't work.
- **Any folder works:** the app uses relative paths, so `https://example.com/reader/` is fine.
- **No special server settings** are needed. The app sets its own security policy, and EPUB
  chapters get theirs from the service worker.

To try a build locally:

```bash
npm run preview
```

## Updating

Rebuild and replace the files. Open copies pick up the new version the next time they load with a
connection, because the app's files are fetched fresh when online and kept only as an offline
fallback. Libraries and notes are untouched by updates.

## Developing

The reader plugins come from their own repositories, through `package.json`:

- [WittyInk](https://github.com/wittywilla/WittyInk)
- [WittyEbook](https://github.com/wittywilla/WittyEbook)
- [WittyPDF](https://github.com/wittywilla/WittyPDF)
- [WittyComics](https://github.com/wittywilla/WittyComics)

To build with plugin changes that aren't released yet, keep their checkouts beside this one and,
after `npm ci`, run `node scripts/dev-modules.mjs` (or name another folder holding them). It copies
them into `node_modules` without touching `package.json`; `npm ci` puts the released ones back.

The themes are WittyMediaServer's. When the server's built-in themes change, run
`node scripts/sync-themes.mjs <server checkout>` and commit `src/themes.json`.

| Folder or file | What's in it |
|---|---|
| `src/App.tsx` | The library, settings and opening books. |
| `src/theme.ts`, `src/themes.json` | The look: the server's themes, or one that follows the device. |
| `src/books.ts` | Adding files (format, title, cover) and the reader host that keeps notes on the device. |
| `src/epub.ts` | Unpacking EPUBs on the device: contents, cover, word counts, search. |
| `src/store.ts` | The on-device database (IndexedDB): books, files and notes. |
| `public/sw.js` | The service worker: shows unpacked EPUBs, keeps the app working offline. |
| `desktop/` | The installed app: its window, its address, opening files from the system, and the installers. |

## Icons

The icons in `public/` and `desktop/build/` (and the disk image's background and the Windows installer's pictures) are
drawn by WittyMediaServer's `scripts/genicon`, the one generator for every logo of the family. With a WittyMediaServer
checkout beside this one, `scripts/sync-brand.sh` redraws them and `scripts/sync-brand.sh --check` says whether they
are up to date. Don't edit them by hand.

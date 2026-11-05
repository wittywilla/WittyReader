# WittyReader

Read and annotate books, PDFs and comics on your own device, with no server and nothing uploaded. You need it if you want the Witty readers without running a WittyMediaServer.

<!-- pictures -->

![A library of books, PDFs and comics](docs/images/reader-library.webp)

<sub>Covers and text from [Standard Ebooks](https://standardebooks.org/), [CC0](https://creativecommons.org/publicdomain/zero/1.0/); Earth as Art, NASA, public domain; [Pepper&Carrot](https://www.peppercarrot.com/), David Revoy, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).</sub>

![A book open in WittyReader](docs/images/reader-book.webp)

<sub>Text and cover from [Standard Ebooks](https://standardebooks.org/), [CC0](https://creativecommons.org/publicdomain/zero/1.0/).</sub>

<!-- /pictures -->

## What it does

**Your library**

- **Add books your way:** the **Add books** button, Ctrl+O, drag and drop, or your system's *Open with* once installed.
- **Continue reading:** the book you're in, front and centre, with your progress.
- **Find anything:** search, filter by books, PDFs or comics, and sort by recent, added, title or author.
- **Covers and titles from the files:** EPUB metadata and covers, PDF first pages, a comic's `ComicInfo.xml`. Books without a cover get one of their own.
- **No duplicates:** adding the same file again finds the copy you have.

**Reading**

- **Books (EPUB),** with [WittyEbook](https://github.com/wittywilla/WittyEbook).
- **PDFs,** with [WittyPDF](https://github.com/wittywilla/WittyPDF).
- **Comics and manga (CBZ),** with [WittyComics](https://github.com/wittywilla/WittyComics).
- **Study tools** from [WittyInk](https://github.com/wittywilla/WittyInk): highlights, notes, bookmarks, citations, reading aloud, and a pen with pressure.

**Private and portable**

- **On the device:** books, positions and notes stay with you. The only outside request is a dictionary look-up, off until you turn it on.
- **Books can't run code:** EPUB files are sandboxed with scripts blocked, and PDF scripts and forms are off.
- **Notes go with you:** export a book's notes to a file and import them on another device, or save a readable Markdown summary.
- **Offline:** it works offline after the first visit.

The guides are in [wiki/](wiki/Home.md): [Getting started](wiki/Getting-started.md), [Your library](wiki/Your-library.md), [Reading](wiki/Reading.md), [Notes and backups](wiki/Notes-and-backups.md), [Privacy and security](wiki/Privacy-and-security.md) and [Troubleshooting](wiki/Troubleshooting.md).

## How to get it

Each release has an installer for each system, made by `electron-builder` from `desktop/`:

| You have | Download |
|---|---|
| Windows 10 or later | `wittyreader-<version>-windows-amd64-setup.exe` |
| A Mac with Apple silicon | `wittyreader-<version>-macos-arm64.dmg` |
| A Mac with an Intel chip | `wittyreader-<version>-macos-x64.dmg` |
| Debian, Ubuntu and relatives | `wittyreader-<version>-linux-amd64.deb` |
| Fedora and relatives | `wittyreader-<version>-linux-amd64.rpm` |
| Any other Linux | `wittyreader-<version>-linux-amd64.AppImage` |
| Your own web server | `wittyreader-<version>.zip`: see [Hosting and building](wiki/Hosting-and-building.md) |

Nothing is code-signed yet, so Windows and macOS warn about the installers. Installed, it opens `.epub`, `.pdf` and `.cbz` files from your system. Removing it asks whether to delete your library and notes as well, which can't be undone. [Installing and removing](wiki/Installing-and-removing.md) has the steps for each system, and every folder involved.

## What it needs

- **Installed:** nothing else. It brings its own Electron.
- **In a browser:** the web app is a plain static site, hosted over **https** or opened from `localhost`, because browsers only allow its offline service worker, which also shows EPUBs, on secure addresses.

It's built on WittyEbook, WittyPDF, WittyComics and WittyInk, with pdf.js, React and fflate.

## Platforms

| System | Where it stands |
|---|---|
| Windows | The setup and uninstaller ran under Wine, in a throwaway container. Not on real Windows |
| Linux | `.deb` and `.rpm` installed, opened on a virtual screen, upgraded and removed in containers. No real desktop yet |
| macOS | The workflow builds for it, and that has not run yet. It has not been run on a real Mac. Its uninstaller's logic only ran on Linux with a stand-in home folder |

## Building and testing

You need [Node.js](https://nodejs.org) 20 or newer. In a worktree, or to build against the reader repositories beside this one, first run the copy of `dev-modules.mjs` kept above the repositories (`node D:/projects/dev-modules.mjs` on the development machine). It writes only `node_modules` links that git ignores.

```bash
npm install
```

```bash
npm run dev
```

```bash
npm run build
```

`npm run dev` serves it at `http://localhost:5180`, and `npm run build` makes the finished app in `dist/`. See [Hosting and building](wiki/Hosting-and-building.md).

The desktop app is in `desktop/`:

```bash
cd desktop
npm ci
npm test
```

`npm run package:win`, `package:mac` and `package:linux` make the installers. `scripts/test` has the checks that really install them:

- `scripts/test/installers-linux.sh` proves the Linux packages in throwaway containers.
- `scripts/test/installers-wine.sh` runs the Windows setup in a throwaway container with Wine.
- `scripts/test/mac-uninstaller.sh` runs the Mac uninstaller's logic against a stand-in home folder. It needs no Mac, and says nothing about a real one.

## Licence

Apache-2.0: see [LICENSE](LICENSE) and [NOTICE](NOTICE). If you redistribute it or build on it, keep the NOTICE attribution.

Bundled in the built app: pdf.js (`pdfjs-dist`, Apache-2.0, Mozilla Foundation) with its image decoders (OpenJPEG, BSD-2-Clause; PDFium's JBIG2 decoder, BSD-3-Clause; qcms, MIT; each licence beside it in `assets/pdfjs-<version>/`), React and React DOM (MIT, Meta Platforms and affiliates), and fflate (MIT, Arjun Barrett). In the installers only, not in the zip: Electron (MIT), which bundles Chromium and FFmpeg, whose licences ship with every installed copy in `LICENSE.electron.txt` and `LICENSES.chromium.html`.

## Legal

WittyReader is an independent open-source project. It isn't associated with, sponsored by or
endorsed by any publisher, rights holder, service or other media software project. No books come
with it, and it doesn't check the ones you open: you're responsible for having the rights to them.
Definitions come from a third-party service. Any third-party names here only describe what it works
with, and belong to their owners. It's provided “as is”, with no warranty; see [LICENSE](LICENSE).
Local law applies to how you use it. This isn't legal advice.

<!-- module-kit -->
## Releasing

A version tag builds the web app and the desktop installers, and attaches them to a release. It isn't delivered through a server.

To release:

1. Raise `version` in `package.json` and in `desktop/package.json`, and commit it.
2. Tag that commit and push the tag: `git tag vX.Y.Z`, then `git push origin vX.Y.Z`. A tag with a
   suffix, such as `v1.2.0-beta`, is published as a prerelease.
3. Watch the *Actions* tab. Nothing is signed yet, so Windows and macOS warn about the installers: see [Installing and removing](wiki/Installing-and-removing.md).

Licensed under Apache-2.0: see [LICENSE](LICENSE) and [NOTICE](NOTICE).
<!-- /module-kit -->

# Your library

Your library is what you see when WittyReader opens: **Continue reading** with the book you're
in, then every book on this device, most recently opened or added first. **Show** narrows it to
books, PDFs or comics, and **Sort** orders it by recent, added, title or author. The search box at
the top finds books by title or author. **Shelf** in the top bar shows the bookshelf, with books
grouped by series and by author.

## Each book shows

- its **cover** (a small copy is made when the book is added, so the shelf stays light);
- a **badge** for its format: EPUB, PDF or Comic;
- a **progress bar** along the bottom of the cover, once you've started it;
- its **title** and **author**.

Click or tap a cover to open the book's page (the one under **Continue reading** opens the book
itself). A book's page shows its cover, format and progress, every note you made in it, and:

- **Read**, **Continue reading** or **Read again**;
- **Export notes:** save this book's notes to a file
  ([Notes and backups](Notes-and-backups));
- **Remove from this device:** delete the book, its reading position and all its notes from this
  device, after asking you first. Export notes first if you want to keep them.

## Supported files

| Format | Details | Title, author, cover from |
|---|---|---|
| **EPUB** (`.epub`) | EPUB 2 and EPUB 3 books | The book's own information: title, author, year and cover image |
| **PDF** (`.pdf`) | Any PDF that isn't password-protected | The PDF's title and author, and its first page as the cover |
| **CBZ** (`.cbz`) | Comic archives of JPEG, PNG, GIF, WebP, AVIF or BMP pages | `ComicInfo.xml` if present (series and issue, title, writer, year, manga direction), else the file name; the first page as the cover |

WittyReader looks at a file's contents, not just its name. A PDF or EPUB with the wrong extension
still opens as the right kind of book.

Not supported yet:

- other comic archives (`.cbr`, `.cb7`);
- other ebook formats.

Books with copy protection (DRM) are refused when you add them.

## The same book twice

Each file is recognised by a fingerprint of its contents (a SHA-256 hash). Adding a book you
already have opens the existing copy with your notes and place, even if the file was renamed. A
different edition of a book counts as a different file.

## Where the books are kept

Books are stored inside your browser's own storage for this site, on this device. When you add
your first book, WittyReader asks the browser to keep this storage even when the disk is nearly
full. **Settings** shows how much space your books and notes use.

Clearing the browser's data for the site, or uninstalling the browser, removes the library. See
[Notes and backups](Notes-and-backups).

## The look

**Settings** has the same two choices as WittyMediaServer:

- **Look:** the finish of the app, from fourteen: glass, gloss and bevels, corner shape, type and how
  closely things are packed.
- **Theme:** the colours, from fifteen built-in themes, **The Look's own**, or **Match this device**,
  which is Witty while the device is dark and Light while it's light. Any Look can wear any Theme.

**Import a theme…** adds a theme from a ZIP of `theme.json`, `theme.css` and any fonts or pictures.
It can set colours and fonts only, and can't reach another site. Imported themes can be removed in
Settings.

The library, menus and the readers' panels take the theme. The pages of a book keep the colours you choose for reading inside the reader.


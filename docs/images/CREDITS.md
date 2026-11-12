# Credits for these pictures

Every picture is taken by `scripts/test/screenshots.mjs` from the built app, headless, with a made-up library: the titles and
authors are invented and the covers are drawn by the script (a gradient, a circle and the title). No one's media is in them.
Run it again after a change to the look: `npm run build`, serve `dist` (`npx vite preview --port 19871`), put the books from
`scripts/test/make-books.mjs` in `dist/_t/`, then `node scripts/test/screenshots.mjs docs/images`.

| Picture | What it shows |
|---|---|
| `reader-library.webp` | The library in the Witty theme with the Lumen look |
| `reader-theme-aero.webp`, `-paper`, `-teletext`, `-midnight` | The same library in Aero (glass, gloss and a sky), Paper, Teletext (Retro) and Midnight (Stage) |
| `reader-book-page.webp`, `reader-notes.webp`, `reader-shelf.webp`, `reader-settings.webp` | A book's page, every note from every book with its filters, the bookshelf, and Settings (module settings, then the Look and Theme pickers) |

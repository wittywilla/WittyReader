# Changelog

What changed in WittyReader, newest first. What changed before it had a repository of its own is in the
[WittyMediaServer changelog](https://github.com/wittywilla/WittyMediaServer/blob/master/CHANGELOG.md).

## 0.1.2 (not released yet)

- **Up to date with the reader plugins**, with pdf.js 6.4.299 and its image decoders, so scanned PDFs show their pictures. A PDF is
  read in pieces as you go instead of whole: opening a 96 MB comic PDF reads 7 MB to show its first page. A PDF that can't be
  read from the device says so instead of loading forever. (#7)
- **Comics are read a page at a time** from the stored file instead of unpacked whole, so a large one no longer needs three
  times its size in memory to open: 0.13 MB read to open a 43 MB comic. A password-protected comic says so. (#11)
- **Finished means finished.** A comic or PDF read to its last page, or a book read to its last words, shows as finished, and
  the library's percentage is the reader's own (it counted chapters for books, and stopped a page short for comics). A save can
  no longer undo another. (#9)
- **On a phone**, the menu of a book in the left column stays on the screen. **With a keyboard or screen reader**, the book menu
  and Settings take the focus and give it back, the arrow keys move through the menu, and a cover says its format. (#10)
- Sorting by author puts the books with no author after the others, not before. (#16)
- A copy-protected EPUB is refused when you add it, with a plain message, instead of opening to unreadable chapters. An EPUB whose fonts are merely scrambled opens as usual.
- WittyReader now has real installers: a setup wizard for Windows, a disk image for macOS, and `.deb`, `.rpm` and AppImage for
  Linux. It's the same app in its own window, served through an address of its own, with the same security policy. The only thing
  it can reach outside itself is the dictionary, and only once you turn that on. The zip stays for people who host it themselves.
- Once installed, `.epub`, `.pdf` and `.cbz` files open in it from your system, and go into the library the same way as added books.
  It joins the Open with list and never takes a file type from another program.
- Removing it asks whether to delete your library, notes and settings too, and says plainly that this can't be undone. Silently on
  Windows it keeps them, unless given `/RemoveData`. macOS has an uninstaller that lists everything and asks first, and Linux
  packages say what's left in your home folder and how to remove it.
- A file opened from the system while another book is open now closes that book properly first.
- A fresh checkout builds again: two of the reader plugins were locked to versions older than the others needed.
- WittyReader is now a project of its own, developed and released from this repository.

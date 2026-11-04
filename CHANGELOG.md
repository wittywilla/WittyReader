# Changelog

What changed in WittyReader, newest first. What changed before it had a repository of its own is in the
[WittyMediaServer changelog](https://github.com/wittywilla/WittyMediaServer/blob/master/CHANGELOG.md).

## Unreleased

- The reader plugins are up to date, with pdf.js 6.4.299 and its image decoders, so scanned PDFs show their pictures. A PDF is read
  in pieces as you go instead of whole, so a large one opens without filling the memory: 7 MB of a 96 MB comic to show its first page.
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

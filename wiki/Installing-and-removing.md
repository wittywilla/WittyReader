# Installing and removing

The [releases page](https://github.com/wittywilla/WittyReader/releases) has an installer for each system. The list of
checksums there has every file in it. The installers aren't code-signed yet, so Windows and macOS warn about them: see each section.

| You have | Download |
|---|---|
| Windows 10 or later | `wittyreader-<version>-windows-amd64-setup.exe` |
| A Mac with Apple silicon | `wittyreader-<version>-macos-arm64.dmg` |
| A Mac with an Intel chip | `wittyreader-<version>-macos-x64.dmg` |
| Debian, Ubuntu and relatives | `wittyreader-<version>-linux-amd64.deb` |
| Fedora and relatives | `wittyreader-<version>-linux-amd64.rpm` |
| Any other Linux | `wittyreader-<version>-linux-amd64.AppImage` |
| Your own web server | `wittyreader-<version>.zip`: see [Hosting and building](Hosting-and-building) |

The Mac `.zip` files hold the same app as the `.dmg`, for people who prefer them.

## What it keeps, and where

**Your library is in the app's data folder, not with the program.** When you add a book, WittyReader keeps its own copy there,
along with your highlights, notes, handwriting, reading positions and settings. Your original files stay where they were.

| System | Folder |
|---|---|
| Windows | `%APPDATA%\WittyReader` |
| macOS | `~/Library/Application Support/WittyReader` |
| Linux | `~/.config/WittyReader` |

It's kept separately for each account on the computer, and it isn't shared with a copy of WittyReader in a browser.

**Deleting that folder loses the books in the library and all your notes, for good.** There's no cloud copy. Before you do, use
[Notes and backups](Notes-and-backups) to export the notes you care about.

Updating never touches it. Removing the program only touches it if you say so.

## Opening files

The installers register `.epub`, `.pdf` and `.cbz` with your system, so **Open with > WittyReader** works from your file manager.
A file opened this way goes into the library the way an added book does, and opens straight away. It never takes a file type from
another program: if something else already opens PDFs, it still does, and WittyReader is one more choice in the list. To change that,
use your system's setting for default apps.

## Windows

**Install.** Open the setup. Windows may say it "protected your PC", because the installer isn't signed: choose **More info**, then
**Run anyway**. Choose **Only for me**, which needs no administrator, or **Anyone who uses this computer**, then the folder. It makes a
desktop shortcut and a Start menu entry. Running a newer setup upgrades in place.

**Remove.** **Settings > Apps > Installed apps > WittyReader > Uninstall**, or **Uninstall WittyReader** in the program's folder. It
then asks whether to delete your library, notes and settings too. No is the safe answer, and the default. If you installed it for
everyone, the question covers your own account's data only: other accounts' folders are theirs to remove.

It removes exactly the files it installed, its shortcuts and its file types. A file type another program has stays with it. If you put something of your own in its folder, that and the folder stay.

**Without any windows, for scripts:**

```bat
wittyreader-<version>-windows-amd64-setup.exe /S
wittyreader-<version>-windows-amd64-setup.exe /S /allusers
wittyreader-<version>-windows-amd64-setup.exe /S /D=C:\Some\Folder
"Uninstall WittyReader.exe" /S
"Uninstall WittyReader.exe" /S /RemoveData
```

`/allusers` needs an administrator, and the uninstaller needs it too for a copy installed that way. Silently, your library
and notes stay unless `/RemoveData` is given. `/D=` has to come last and takes no quotes.

## macOS

**Install.** Open the `.dmg` and drag **WittyReader** to **Applications**. The first time, the Mac refuses an app that isn't signed: in
**System Settings > Privacy & Security**, choose **Open Anyway**.

**Remove everything.** Run **Uninstall WittyReader.command**, which is on the `.dmg`. If you no longer have that, it's also inside
the app, so you can run this in Terminal:

```bash
"/Applications/WittyReader.app/Contents/Resources/Uninstall WittyReader.command"
```

It lists what it found and asks before removing anything: this includes your library and notes. Add `--dry-run` to see the list
and stop. It looks for:

- `/Applications/WittyReader.app`, and the same in `~/Applications`
- `~/Library/Application Support/WittyReader`
- `~/Library/Caches/WittyReader`, `com.wittywilla.wittyreader` and `com.wittywilla.wittyreader.ShipIt`
- `~/Library/HTTPStorages/com.wittywilla.wittyreader` and the same with `.binarycookies`
- `~/Library/Logs/WittyReader`
- `~/Library/Preferences/com.wittywilla.wittyreader.plist` and `.helper.plist`
- `~/Library/Saved Application State/com.wittywilla.wittyreader.savedState`
- `~/Library/WebKit/com.wittywilla.wittyreader`

The first time you double-click it, the Mac may refuse it for the same reason as the app: right-click it and choose **Open**. To
keep your library and only remove the program, drag the app to the Trash instead.

## Linux

**`.deb`:**

```bash
sudo apt install ./wittyreader-<version>-linux-amd64.deb
sudo apt remove wittyreader        # or: sudo apt purge wittyreader
```

**`.rpm`:**

```bash
sudo dnf install ./wittyreader-<version>-linux-amd64.rpm
sudo dnf remove wittyreader
```

Both bring in the libraries the app needs and add the `wittyreader` command, a menu entry and the file types. Installing a newer
package upgrades in place. Removing takes away everything on the system. A plain `apt remove` and a purge do the same, since it
has no system-wide settings.

**A package can't reach anyone's home folder**, so removing it leaves your library and notes, and it says so. To delete yours as
well, which can't be undone:

```bash
rm -rf ~/.config/WittyReader
```

The system's own libraries, which many programs share, may also have made `~/.cache/dconf`, `~/.cache/fontconfig`, `~/.cache/mesa_shader_cache*`
`~/.config/pulse` and `~/.local/share/pki/nssdb` when the app ran. They aren't the app's, so nothing here removes them.

**AppImage:** make it executable and run it. To remove it, delete the file. It doesn't register file types by itself. Your library
is in the same folder as above, and goes the same way.

## In a browser

If you use WittyReader in a browser, your library is in that browser's storage for the site instead. Removing the app there, or
clearing the site's data, is up to the browser. See [Troubleshooting](Troubleshooting).

## What's been tested

The Linux packages have been installed, opened, upgraded and removed in Debian, Ubuntu and Fedora containers, with a comparison of
the whole file system from before and after. The Windows setup has been run under Wine, the same way, with the registry too. Neither a
real Windows nor a real Mac has run these yet. The Mac uninstaller's logic has only been run on Linux with a stand-in home folder.

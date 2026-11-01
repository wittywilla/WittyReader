#!/usr/bin/env bash
# Runs the Mac uninstaller's logic against a stand-in home folder. It doesn't need a Mac, and it
# isn't one: this says nothing about the Finder, Gatekeeper or the system's own commands.
#
#   scripts/test/mac-uninstaller.sh
set -u

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="$(ls "$HERE"/../../desktop/build/mac/Uninstall*.command)"
APP=WittyReader
ID=com.wittywilla.wittyreader
EXTRA=("Library/Application Support/$APP/IndexedDB/wittyreader_0.indexeddb.leveldb/x")

fail() { echo "FAIL: $*"; exit 1; }
HOME="$(mktemp -d)"; export HOME
trap 'rm -rf "$HOME"' EXIT
cd "$HOME" || exit 1

make() {
  for f in "Applications/$APP.app/Contents/Info.plist" \
    "Library/Application Support/$APP/state.json" "${EXTRA[@]}" \
    "Library/Caches/$APP/x" "Library/Caches/$ID/x" "Library/Caches/$ID.ShipIt/x" \
    "Library/HTTPStorages/$ID/x" "Library/HTTPStorages/$ID.binarycookies" \
    "Library/Logs/$APP/x" "Library/Preferences/$ID.plist" "Library/Preferences/$ID.helper.plist" \
    "Library/Saved Application State/$ID.savedState/x" "Library/WebKit/$ID/x"; do
    mkdir -p "$(dirname "$f")"; echo x > "$f"
  done
}
make
mkdir -p "Library/Application Support/SomethingElse" Books
echo mine > "Library/Application Support/SomethingElse/keep"
echo mine > "Library/Preferences/com.someone.else.plist"
echo book > "Books/A Made-Up Book.epub"
find . | sort > /tmp/witty-all.$$

bash "$SCRIPT" --dry-run > out.txt || fail "the dry run failed"
cat out.txt
grep -q 'Dry run: nothing was removed' out.txt || fail "the dry run doesn't say so"
rm out.txt
diff <(find . | sort) /tmp/witty-all.$$ > /dev/null || fail "the dry run changed something"
echo "dry run: nothing changed"

echo no | bash "$SCRIPT" > out.txt; rm out.txt
diff <(find . | sort) /tmp/witty-all.$$ > /dev/null || fail "answering no changed something"
echo "answering no: nothing changed"

echo yes | bash "$SCRIPT" > out.txt || { cat out.txt; fail "answering yes failed"; }
tail -n 3 out.txt; rm out.txt
echo "what's left:"
find . -type f | sort
[ "$(find . -type f | sort | tr '\n' ' ')" = "./Books/A Made-Up Book.epub ./Library/Application Support/SomethingElse/keep ./Library/Preferences/com.someone.else.plist " ] || fail "the wrong things are left"
out="$(bash "$SCRIPT" 2>&1)"
echo "$out" | grep -q 'nothing to remove' || fail "a second run should find nothing"
rm -f /tmp/witty-all.$$
echo PASSED

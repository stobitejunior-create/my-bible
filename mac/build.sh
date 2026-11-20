#!/bin/bash
# Builds dist/My Bible.app: a native window around dist/bible.html (run python3 build.py first).
# Usage: mac/build.sh [--install]   (--install copies it to /Applications)
set -euo pipefail
cd "$(dirname "$0")/.."
APP="dist/My Bible.app"
TMP=$(mktemp -d)
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources/web"
# Swift only allows top-level startup code in main.swift, so compile MyBible.swift under that name.
cp mac/MyBible.swift "$TMP/main.swift"
swiftc -O -target arm64-apple-macos13 -o "$TMP/MyBible-arm64" "$TMP/main.swift" mac/Epub.swift mac/Library.swift -framework Cocoa -framework WebKit -framework QuickLookThumbnailing
swiftc -O -target x86_64-apple-macos13 -o "$TMP/MyBible-x86_64" "$TMP/main.swift" mac/Epub.swift mac/Library.swift -framework Cocoa -framework WebKit -framework QuickLookThumbnailing
lipo -create -output "$APP/Contents/MacOS/MyBible" "$TMP/MyBible-arm64" "$TMP/MyBible-x86_64"
cp mac/Info.plist "$APP/Contents/Info.plist"
cp dist/bible.html "$APP/Contents/Resources/web/bible.html"
# PDF engine for the Library reader (Mozilla pdf.js, Apache 2.0)
cp -R vendor/pdfjs "$APP/Contents/Resources/web/pdfjs"
# icon
swift mac/make_icon.swift "$TMP/icon.png"
ICONSET="$TMP/AppIcon.iconset"; mkdir -p "$ICONSET"
for s in 16 32 128 256 512; do
  sips -z $s $s "$TMP/icon.png" --out "$ICONSET/icon_${s}x${s}.png" >/dev/null
  sips -z $((s*2)) $((s*2)) "$TMP/icon.png" --out "$ICONSET/icon_${s}x${s}@2x.png" >/dev/null
done
iconutil -c icns "$ICONSET" -o "$APP/Contents/Resources/AppIcon.icns"
codesign --force --deep -s - "$APP" >/dev/null
rm -rf "$TMP"
echo "Built $APP"
if [[ "${1:-}" == "--install" ]]; then
  rm -rf "/Applications/My Bible.app"
  cp -R "$APP" "/Applications/My Bible.app"
  echo "Installed to /Applications/My Bible.app"
fi

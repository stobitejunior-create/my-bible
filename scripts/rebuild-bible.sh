#!/bin/bash
# rebuild-bible ["what changed"]
# Builds the app, the phone site (docs/) and the Mac app (installs /Applications/My Bible.app),
# commits everything and pushes to GitHub (plain push, no Actions). GitHub Pages then serves docs/.
set -e
cd "$(dirname "$(readlink -f "$0" 2>/dev/null || echo "$0")")/.." || exit 1
msg="${1:-}"

echo "▸ Building the app and the phone site"
python3 build.py
python3 pages/make_site.py

echo "▸ Building My Bible.app"
osascript -e 'quit app "My Bible"' 2>/dev/null || true
mac/build.sh --install

echo "▸ Committing"
git add -A
if git diff --cached --quiet; then echo "  (no changes to commit)"; else git commit -q -m "${msg:-Update My Bible}"; fi
pushed=""
for try in 1 2 3; do
  if git push -q 2>/dev/null; then pushed=1; break; fi
  sleep 4
done
if [ -n "$pushed" ]; then echo "  pushed to GitHub; the phone site updates in a minute or two"; else echo "  (couldn't push to GitHub; run 'git push' in this folder later)"; fi
echo "✓ Done"

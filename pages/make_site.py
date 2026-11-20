"""Build the GitHub Pages copy of the app into docs/ (served at https://<user>.github.io/<repo>/).

docs/index.html = dist/bible.html (run python3 build.py first) plus the tags a phone needs to add it to the
home screen as an app: manifest, icon, standalone mode, and the offline cache (docs/sw.js).
The other files in docs/ (manifest, sw.js, icons, robots.txt, .nojekyll) are kept in git as they are.
Run from the project root: python3 pages/make_site.py
"""
from pathlib import Path

root = Path(__file__).resolve().parent.parent
html = (root / 'dist' / 'bible.html').read_text(encoding='utf-8')
head = '''<meta name="robots" content="noindex,nofollow">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="My Bible">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#1c1c1e" media="(prefers-color-scheme: dark)">
<link rel="manifest" href="manifest.webmanifest">
<link rel="apple-touch-icon" href="icon-180.png">
<link rel="icon" href="icon-192.png">
<script>if('serviceWorker' in navigator&&location.protocol==='https:')addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));</script>
'''
assert html.count('</head>') >= 1
html = html.replace('</head>', head + '</head>', 1).replace('<title>Bible</title>', '<title>My Bible</title>', 1)
(root / 'docs' / 'index.html').write_text(html, encoding='utf-8')
print(f'docs/index.html  {len(html) / 1e6:.2f} MB')
# PDF engine for the Library reader (Mozilla pdf.js, Apache 2.0), loaded only when a PDF is opened
import shutil
shutil.copytree(root / 'vendor' / 'pdfjs', root / 'docs' / 'pdfjs', dirs_exist_ok=True)

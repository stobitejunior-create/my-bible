// Offline support for the home-screen app.
// The app opens straight from the copy saved on the phone (instant, no data used, works with no signal), and then checks
// GitHub in the background. If there is a newer version it is saved and the page is told, so it can offer "Reload".
// The whole app, with every bundled Bible version, is one file (index.html), so saving it saves everything.
const CACHE = 'my-bible';
const FILES = ['./', './index.html', './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png'];
const PAGE = './index.html';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => { e.waitUntil(self.clients.claim()); });

const stamp = r => r && (r.headers.get('etag') || r.headers.get('last-modified') || r.headers.get('content-length') || '');

// Fetch the latest page; save it, and tell open pages when it differs from the saved copy.
async function refresh(tell) {
  const c = await caches.open(CACHE);
  const old = await c.match(PAGE);
  const r = await fetch(PAGE, { cache: 'no-cache' });
  if (!r.ok) return false;
  const changed = !old || stamp(old) !== stamp(r);
  if (changed) {
    await c.put(PAGE, r.clone()); await c.put('./', r.clone());
    if (old && tell) for (const cl of await self.clients.matchAll({ type: 'window' })) cl.postMessage({ type: 'updated' });
  }
  return changed;
}

self.addEventListener('message', e => {
  if (e.data === 'check') e.waitUntil(refresh(true).then(ch => e.source && e.source.postMessage({ type: 'checked', changed: ch })).catch(() => e.source && e.source.postMessage({ type: 'checked', offline: true })));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  const isPage = e.request.mode === 'navigate' || /\/(index\.html)?$/.test(url.pathname);
  if (isPage) {
    e.respondWith(caches.match(PAGE).then(saved => {
      if (saved) { e.waitUntil(refresh(true).catch(() => {})); return saved; }
      return fetch(e.request).then(r => { if (r.ok) { const a = r.clone(), b = r.clone(); caches.open(CACHE).then(c => { c.put(PAGE, a); c.put('./', b); }); } return r; });
    }));
    return;
  }
  // icons and manifest: saved copy first, network otherwise
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(r => r || fetch(e.request).then(n => {
    if (n.ok) { const copy = n.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); } return n;
  })));
});

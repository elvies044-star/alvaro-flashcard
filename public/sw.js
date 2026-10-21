// Service worker: app bisa dipasang di HP dan tetap terbuka saat sinyal lemah.
// Data (/api) selalu langsung ke server, tidak pernah disimpan di cache.
const CACHE = 'aft-shell-v1';
self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/') || url.pathname === '/version.json') return;
  if (req.mode === 'navigate') {
    // halaman: ambil versi terbaru dulu, pakai cache kalau offline
    e.respondWith(fetch(req).then((r) => { const c = r.clone(); caches.open(CACHE).then((x) => x.put('/', c)); return r; }).catch(() => caches.match('/')));
    return;
  }
  if (/^\/assets\/|\.(png|webmanifest)$/.test(url.pathname)) {
    // file build punya nama unik: cache dulu
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => { if (r.ok) { const c = r.clone(); caches.open(CACHE).then((x) => x.put(req, c)); } return r; })));
  }
});

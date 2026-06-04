// NimiBeats.fm Service Worker
// Caches the app shell so it loads offline / on flaky LAN connections

const CACHE = 'nimibeats-v1';
const SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Inter+Tight:wght@600;700;800&display=swap',
];

// Install: cache app shell
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL.map(url => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()) // don't fail install if fonts are unavailable
  );
});

// Activate: clean old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch strategy:
// - App shell (HTML, manifest, icons) → cache first, fallback to network
// - Jellyfin API / media → network only (never cache media streams)
// - Google Fonts → network first, fallback to cache
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Never intercept Jellyfin API or audio streams
  if (
    e.request.url.includes('/Users/') ||
    e.request.url.includes('/Items/') ||
    e.request.url.includes('/Artists') ||
    e.request.url.includes('/Audio/') ||
    e.request.url.includes('/Playlists') ||
    e.request.url.includes('/Sessions/')
  ) {
    return; // let browser handle normally
  }

  // Google Fonts: network first, cache fallback
  if (url.hostname.includes('fonts.g')) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // App shell: cache first
  e.respondWith(
    caches.match(e.request)
      .then(cached => cached || fetch(e.request)
        .then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
          return res;
        })
      )
  );
});

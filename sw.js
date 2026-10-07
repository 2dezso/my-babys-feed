const CACHE_NAME = 'baby-feed-v62';
const SHELL_FILES = [
  './index.html',
  './style.css?v=62',
  './app.js?v=62',
  './patterns.js?v=62',
  './manifest.json?v=62',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  // Pages go network-first so a home-screen launch picks up a new deploy immediately;
  // the cached shell is only the offline fallback.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request.url, { cache: 'no-store' })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});

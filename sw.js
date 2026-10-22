const CACHE_NAME = 'baby-feed-v174';
const SHELL_FILES = [
  './index.html',
  './style.css?v=174',
  './app.js?v=174',
  './patterns.js?v=174',
  './manifest.json?v=174',
  './fonts/nunito.css?v=174',
  './fonts/nunito-latin.woff2',
  './fonts/nunito-latin-ext.woff2',
  './fonts/nunito-vietnamese.woff2',
  './fonts/nunito-cyrillic.woff2',
  './fonts/nunito-cyrillic-ext.woff2',
  './vendor/firebase-app.js',
  './vendor/firebase-auth.js',
  './vendor/firebase-firestore.js',
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

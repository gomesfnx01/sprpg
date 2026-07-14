/* ============================================================
   service-worker.js — cache do app shell para uso offline/instalável
   ============================================================ */
const CACHE_NAME = 'rpg-progressao-v8';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/reset.css',
  './css/theme.css',
  './css/animations.css',
  './js/core/utils.js',
  './js/core/storage.js',
  './js/core/xp.js',
  './js/core/ui.js',
  './js/core/sound.js',
  './js/missions/daily.js',
  './js/missions/fitness.js',
  './js/missions/studies.js',
  './js/missions/finance.js',
  './js/missions/rewards.js',
  './js/app.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png'
];

// Versão do manifest dos cards (incrementar quando mudar)
const CARDS_MANIFEST_VERSION = '1';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const isImage = /\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i.test(event.request.url);
  const isManifest = url.pathname.includes('CARDS/manifest.json');

  // Para imagens e manifest dos cards: stale-while-revalidate
  if (isImage || isManifest) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // Para HTML/CSS/JS: rede primeiro
  event.respondWith(
    fetch(event.request, { cache: 'no-store' })
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return networkResponse;
      })
      .catch(() => caches.match(event.request))
  );
});
/* EventSphere service worker.
   A registered service worker WITH a fetch handler is required (alongside the
   web manifest) for Chrome to fire `beforeinstallprompt` — which is what powers
   the "Install EventSphere" prompt (see src/components/InstallPrompt.jsx).

   This is registered in production only (see pages/_app.jsx); in dev the app
   still unregisters service workers to avoid the old CRA cache-first HMR reload loop. */

const CACHE = 'eventsphere-v1';
const PRECACHE = ['/', '/manifest.json', '/favicon.ico', '/logo192.png', '/logo512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      // Drop any caches that aren't the current version (incl. the old CRA ones).
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle same-origin GETs; let everything else (APIs, cross-origin) hit the network.
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  // Page navigations: network-first so users always get fresh HTML, with a cache fallback offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/')))
    );
    return;
  }

  // Static assets: cache-first for speed, then fall back to the network and cache the result.
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
          return res;
        })
    )
  );
});

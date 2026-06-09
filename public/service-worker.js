/* EventSphere service worker.
   A registered service worker WITH a fetch handler is required (alongside the
   web manifest) for Chrome to fire `beforeinstallprompt` — which is what powers
   the "Install EventSphere" prompt (see src/components/InstallPrompt.jsx).

   This is registered in production only (see pages/_app.jsx); in dev the app
   still unregisters service workers to avoid the old CRA cache-first HMR reload loop.

   Caching strategy (important — see below):
   - /api/*            → NEVER cached. Always network. (Otherwise deleted/edited
                         data keeps showing because a stale API response is served
                         from cache. This was the bug behind "deleted user still
                         shows in Chrome but is fine in Opera".)
   - navigations       → network-first (fresh HTML), cache fallback only offline.
   - /_next/static/* and
     hashed static files → cache-first (safe: filenames are content-hashed, so a
                         new deploy = new filename, never stale code).
   - everything else   → network-first. */

const CACHE = 'eventsphere-v2';
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
      // Drop any caches that aren't the current version. Bumping CACHE above also
      // purges old caches that may hold stale API responses from a previous SW.
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

const isCacheableAsset = (pathname) =>
  pathname.startsWith('/_next/static/') ||
  /\.(?:js|css|png|jpe?g|gif|svg|webp|avif|ico|woff2?|ttf|eot)$/.test(pathname);

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Cross-origin (e.g. Cloudinary, analytics): let the network handle it.
  if (url.origin !== self.location.origin) return;

  // API calls must always be fresh — never serve a cached response.
  if (url.pathname.startsWith('/api/')) return;

  // Page navigations: network-first so users get fresh HTML; fall back to cache offline.
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

  // Content-hashed build assets / static files: cache-first for speed (never stale).
  if (isCacheableAsset(url.pathname)) {
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
    return;
  }

  // Everything else: network-first, so dynamic content is never served stale.
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});

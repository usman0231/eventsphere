/* Kill-switch service worker.
   The app migrated from CRA (PWA) to Next.js and no longer uses a service worker.
   Any browser that still has the old EventSphere SW registered will fetch this file
   on its next update check, install it, and it will unregister itself + clear all
   caches — fixing the dev HMR reload loop caused by the old cache-first SW. */
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      await self.registration.unregister();
    })()
  );
});
// No fetch handler — nothing is intercepted or cached. The SW does not reload anything;
// it just clears caches and unregisters itself, then the next manual refresh is clean.

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open("offline");
    await cache.add(new Request("./offline.html", {cache: 'reload'}));
  })());
  console.log("installed")
  //self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    if ('navigationPreload' in self.registration) {
      await self.registration.navigationPreload.enable();
    }
  })());
  console.log("activated")
  //self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const preloadResponse = await event.preloadResponse;
        if (preloadResponse) {
          return preloadResponse;
        }
        const networkResponse = await fetch(event.request);
        return networkResponse;
      } catch (error) {
        console.log('Fetch failed; returning offline page instead.', error);

        const cache = await caches.open("offline");
        const cachedResponse = await cache.match("./offline.html");
        return cachedResponse;
      }
    })());
  }
});

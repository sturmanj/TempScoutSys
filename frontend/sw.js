let statics = [
  './',
  './index.html',
  './offline.html',
  './app.js',
  './style.css',
  './sw.js',
  './manifest.json',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open("statics").then((cache) => {cache.addAll(statics)}),
  )
  console.log("installed")
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    if ('navigationPreload' in self.registration) {
      await self.registration.navigationPreload.enable();
    }
  })());
  console.log("activated")
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  console.log(event.request.url);
  event.respondWith(
    caches.match(event.request).then((response) => response || fetch(event.request)).catch((error) => {}),
  );
});
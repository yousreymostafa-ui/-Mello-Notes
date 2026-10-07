const CACHE_NAME = "mello-notes-v4";
const APP_FILES = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./icons/icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_FILES)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key.startsWith("mello-notes-") && key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(async () => {
        // Make sure no stale Secret Links / F Notes pages survive in any cache.
        const keys = await caches.keys();
        await Promise.all(keys.map(async key => {
          const cache = await caches.open(key);
          const requests = await cache.keys();
          await Promise.all(
            requests
              .filter(req => new URL(req.url).pathname.includes("/secret-links/"))
              .map(req => cache.delete(req))
          );
        }));
      })
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // The F Notes mini-app changes independently. Never serve stale cached UI for it.
  if (url.pathname.includes("/secret-links/")) {
    event.respondWith(
      fetch(event.request, { cache: "no-store" }).catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached =>
      cached || fetch(event.request).then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        return response;
      }).catch(() => caches.match("./index.html"))
    )
  );
});

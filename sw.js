// ============================================
// Service Worker - WashU Squash Offline Support
// ============================================

var CACHE_NAME = "washu-squash-v1";
var ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./data.js",
  "./data.json"
];

// Install: cache core assets
self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(
        names
          .filter(function (name) { return name !== CACHE_NAME; })
          .map(function (name) { return caches.delete(name); })
      );
    })
  );
  self.clients.claim();
});

// Fetch: network-first for data.json (scores update frequently),
// cache-first for everything else
self.addEventListener("fetch", function (e) {
  var url = new URL(e.request.url);

  // data.json — try network first so we get fresh scores, fall back to cache
  if (url.pathname.endsWith("/data.json")) {
    e.respondWith(
      fetch(e.request)
        .then(function (response) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(e.request, clone);
          });
          return response;
        })
        .catch(function () {
          return caches.match(e.request);
        })
    );
    return;
  }

  // Everything else — cache-first, fall back to network
  e.respondWith(
    caches.match(e.request).then(function (cached) {
      if (cached) return cached;
      return fetch(e.request).then(function (response) {
        // Cache same-origin responses for offline use
        if (response.ok && url.origin === self.location.origin) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(e.request, clone);
          });
        }
        return response;
      });
    })
  );
});

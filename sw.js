const CACHE = "pslite-v10";
const ASSETS = [
  ".",
  "index.html",
  "style.css",
  "app.js",
  "brushes.js",
  "psd.js",
  "ext-core.js",
  "ext-layers.js",
  "ext-adjust.js",
  "ext-doc.js",
  "ext-boot.js",
  "manifest.webmanifest",
  "icons/icon.svg",
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
/* network-first: selalu coba versi terbaru, cache hanya cadangan saat offline */
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request).then(res => {
      if (res && res.ok && new URL(e.request.url).origin === location.origin) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match(e.request).then(c => c || caches.match("index.html")))
  );
});

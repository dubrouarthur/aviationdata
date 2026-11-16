// The offline copy of aviationdata (registered by src/site/chrome.js, production over https only).
// - pages, data and the search index: the network first, the last copy read when offline (a page of a
//   new deployment must never run against the data of the previous one);
// - /assets/ (names carry a hash, never change): the cache first;
// - maps, images, icons: the copy at hand at once, refreshed in the background;
// - the wind fields (.bin, several megabytes each) are never cached.
// VERSION is set by the build (partials.js, writeBundle) from the names of the deployment's assets: a new
// deployment empties the caches of the previous one.
const VERSION = "dev";
const PAGES = `pages-${VERSION}`;
const STATIC = `static-${VERSION}`;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.endsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin || url.pathname.endsWith(".bin")) return;

  /** the network first; a copy kept for when it fails */
  const networkFirst = (fallback) =>
    fetch(req)
      .then((res) => {
        if (res.ok) caches.open(PAGES).then((c) => c.put(req, res.clone()));
        return res;
      })
      .catch(() =>
        caches
          .match(req)
          .then((hit) => hit || fallback?.())
          .then((hit) => hit || Response.error()),
      );

  if (req.mode === "navigate") {
    event.respondWith(networkFirst(() => caches.match(new URL("./", location.href).href)));
    return;
  }

  if (/\/data\/|\.json$/.test(url.pathname)) {
    event.respondWith(networkFirst());
    return;
  }

  if (url.pathname.includes("/assets/")) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) caches.open(STATIC).then((c) => c.put(req, res.clone()));
            return res;
          }),
      ),
    );
    return;
  }

  if (/\/(geo|icons|img)\/|\.(jpg|png|svg)$/.test(url.pathname)) {
    event.respondWith(
      caches.open(STATIC).then((cache) =>
        cache.match(req).then((hit) => {
          const net = fetch(req)
            .then((res) => {
              if (res.ok) cache.put(req, res.clone());
              return res;
            })
            .catch(() => hit);
          return hit || net;
        }),
      ),
    );
  }
});

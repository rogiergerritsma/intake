var V = 'rondgang-202610171932';
var A = ['./', 'index.html', 'style.css', 'app.js', 'teksten.js', 'version.js', 'config.json', 'manifest.webmanifest', 'logo.png',
  'vendor/jspdf.umd.min.js', 'icon-180.png', 'icon-192.png', 'icon-512.png',
  'fonts/playfair-display-latin-600-normal.woff2', 'fonts/playfair-display-latin-700-normal.woff2',
  'fonts/jost-latin-400-normal.woff2', 'fonts/jost-latin-500-normal.woff2', 'fonts/jost-latin-600-normal.woff2',
  'fonts/ibm-plex-mono-latin-500-normal.woff2'];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(V).then(function (c) { return c.addAll(A); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== V; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
/* Eerst het netwerk (dan zie je updates direct), bij geen of trage verbinding de opgeslagen versie. */
self.addEventListener('fetch', function (e) {
  var r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  e.respondWith(new Promise(function (res) {
    var done = false;
    var fall = function () { caches.match(r, { ignoreSearch: true }).then(function (m) { if (!done) { done = true; res(m || fetch(r)); } }); };
    var t = setTimeout(fall, 4000);
    fetch(r).then(function (x) {
      clearTimeout(t);
      if (x && x.ok) { var c = x.clone(); caches.open(V).then(function (ca) { ca.put(r, c); }); }
      if (!done) { done = true; res(x); }
    }).catch(function () { clearTimeout(t); fall(); });
  }));
});

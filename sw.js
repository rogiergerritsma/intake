var V = 'rondgang-202610171750';
var A = ['./', 'index.html', 'style.css', 'app.js', 'config.json', 'manifest.webmanifest', 'vendor/jspdf.umd.min.js', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(V).then(function (c) { return c.addAll(A); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== V; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  var cfg = /config\.json$/.test(r.url);
  e.respondWith(cfg
    ? fetch(r).then(function (x) { var c = x.clone(); caches.open(V).then(function (ca) { ca.put(r, c); }); return x; }).catch(function () { return caches.match(r); })
    : caches.match(r).then(function (m) { return m || fetch(r); }));
});

// FM Hub: service worker. Guarda la web y los últimos datos para poder abrirla sin conexión
// (enseña lo último que se vio). Siempre intenta primero la red para tener los datos al día.
const CACHE = 'fmhub-v4';
const BASE = ['./', 'index.html', 'app.js', 'curiosidades.js', 'historia.js', 'app.css', 'varela_base.css', 'manifest.webmanifest', 'icono.svg', 'icono-192.png', 'icono-512.png'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(BASE)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.endsWith('/api/exportar-html')) return;
  // datos.json?t=... (marca para saltar la caché de GitHub Pages): se guarda sin la marca, una sola copia
  const sinMarca = u.searchParams.has('t') ? u.origin + u.pathname : e.request;
  e.respondWith(fetch(e.request).then(r => {
    if (r.ok) { const copia = r.clone(); caches.open(CACHE).then(c => c.put(sinMarca, copia)); }
    return r;
  }).catch(() => caches.match(sinMarca)));
});

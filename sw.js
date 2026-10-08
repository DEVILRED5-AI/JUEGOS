// Service worker de "Mis Juegos": permite instalar la app y jugar sin internet.
// Si cambias archivos importantes, sube el número de VERSION para forzar la actualización.
const VERSION = 'v7';
const CACHE = 'mis-juegos-' + VERSION;

// Archivos base que se guardan al instalar
const BASE = [
  './',
  'index.html',
  'manifest.webmanifest',
  'icon-192.png',
  'icon-512.png',
  'icon-maskable-512.png',
  'apple-touch-icon.png',
  'favicon-32.png',
  'icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(BASE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('mis-juegos-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Estrategia: responde con lo guardado y actualiza en segundo plano.
// Así cada juego nuevo se guarda solo la primera vez que lo abres.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const mismoSitio = url.origin === self.location.origin;
  const fuentes = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!mismoSitio && !fuentes) return;

  // Lista de juegos (juegos.json): primero internet, para ver al instante un juego recién agregado.
  // Se guarda con una clave fija para no acumular copias.
  if (url.pathname.endsWith('/juegos.json')) {
    const clave = new Request(url.origin + url.pathname);
    event.respondWith(
      fetch(req)
        .then((resp) => {
          if (resp && resp.ok) {
            const copia = resp.clone();
            caches.open(CACHE).then((c) => c.put(clave, copia));
          }
          return resp;
        })
        .catch(() => caches.match(clave))
    );
    return;
  }

  // Páginas (menú y juegos): primero internet, así siempre ves la versión más nueva.
  // Si no hay conexión, se usa la copia guardada.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((resp) => {
          const copia = resp.clone();
          caches.open(CACHE).then((c) => c.put(req, copia));
          return resp;
        })
        .catch(() =>
          caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match('index.html'))
        )
    );
    return;
  }

  event.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(req, { ignoreSearch: true }).then((guardado) => {
        const red = fetch(req)
          .then((resp) => {
            if (resp && (resp.ok || resp.type === 'opaque')) cache.put(req, resp.clone());
            return resp;
          })
          .catch(() => guardado);
        return guardado || red;
      })
    )
  );
});

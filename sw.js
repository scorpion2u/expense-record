const CACHE_NAME = 'expense-github-v2';

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      const cached = await cache.match(event.request);
      if (cached) return cached;

      try {
        const res = await fetch(event.request);

        if (res && res.status === 200) {
          cache.put(event.request, res.clone());
        }

        return res;
      } catch (err) {
        if (event.request.headers.get('accept')?.includes('text/html')) {
          return cache.match('./index.html');
        }

        return new Response('离线不可用', { status: 503 });
      }
    })()
  );
});
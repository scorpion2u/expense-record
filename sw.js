const CACHE_NAME = 'expense-github-v7';

const STATIC_ASSETS = [
  '/expense-record/',
  '/expense-record/index.html',
  '/expense-record/manifest.json',
  '/expense-record/icon-192.png',
  '/expense-record/icon-512.png'
  '/expense-record/css/styles.css',
  '/expense-record/js/app.js',
  '/expense-record/js/events.js',
  '/expense-record/js/ui.js',
  '/expense-record/js/db.js',
  '/expense-record/js/utils.js',
  '/expense-record/js/constants.js',
  '/expense-record/js/modal.js'
];

// 安装
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

// 激活
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

// 请求拦截
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
        // 👇 关键 fallback
        return cache.match('/expense-record/index.html');
      }
    })()
  );
});
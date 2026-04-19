// 自动缓存版 sw.js - 适合网络不稳定的环境
const CACHE_NAME = 'expense-cache-v4';

// 需要确保离线时能返回页面的核心文件
const CORE_FILES = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './js/events.js',
  './js/ui.js',
  './js/db.js',
  './js/utils.js',
  './js/constants.js',
  './js/modal.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CORE_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // HTML → Network First
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // JS / CSS → SWR
  if (
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css')
  ) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(event.request);

        const fetchPromise = fetch(event.request).then(res => {
          if (res && res.status === 200) {
            cache.put(event.request, res.clone());
          }
          return res;
        }).catch(() => null);

        return cached || fetchPromise;
      })()
    );
    return;
  }

  // 其他 → Cache First
  event.respondWith(
    caches.match(event.request).then(res => res || fetch(event.request))
  );
});
// 自动缓存版 sw.js - 适合网络不稳定的环境
const CACHE_NAME = 'expense-cache-v2';

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
  
  // 对 HTML 页面使用 Network First 策略
  if (event.request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // 网络请求成功，缓存响应
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // 网络失败，尝试返回缓存
          return caches.match(event.request);
        })
    );
    return;
  }
  
  // 对静态资源使用 Cache First 策略
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then(response => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        });
      })
  );
});
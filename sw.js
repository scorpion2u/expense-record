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
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // 如果有缓存，直接返回
        if (cachedResponse) {
          return cachedResponse;
        }
        // 没有缓存，发起网络请求
        return fetch(event.request).then(response => {
          // 请求成功，将响应克隆并存入缓存
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
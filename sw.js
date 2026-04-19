// 为移动端优化的 Service Worker
const CACHE_NAME = 'expense-app-v1';
const urlsToCache = [
  './',
  './index.html',
  './css/styles.css',
  './js/constants.js',
  './js/db.js',
  './js/utils.js',
  './js/modal.js',
  './js/ui.js',
  './js/events.js',
  './js/app.js',
  './manifest.json'
  // 注意：图标文件缓存可能导致存储空间过大，故省略，离线时可能不显示图标
];

// 安装时立即缓存所有核心文件
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting()) // 立即激活，不等待旧SW
  );
});

// 激活时清理旧缓存
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    )).then(() => self.clients.claim()) // 立即控制所有页面
  );
});

// 核心：优先使用缓存，回退网络
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // 有缓存直接返回，实现秒开和离线可用
        return cachedResponse || fetch(event.request);
      })
  );
});
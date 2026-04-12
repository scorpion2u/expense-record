// sw.js
const CACHE_NAME = 'expense-record-v2'; // 版本升级时修改这里即可更新缓存

const urlsToCache = [
  '/expense-record/',
  '/expense-record/index.html',
  '/expense-record/manifest.json',
  '/expense-record/icon-192.png',
  '/expense-record/icon-512.png'
];

// 安装事件
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('缓存已打开');
      return cache.addAll(urlsToCache);
    })
  );
  // 跳过等待，立即激活
  self.skipWaiting();
});

// 激活事件：清理旧缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('删除旧缓存:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// 请求拦截：缓存优先策略（适合记账本这种离线优先应用）
self.addEventListener('fetch', (event) => {
  // 跳过 chrome-extension 和非 GET 请求
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // 如果有缓存，直接返回，同时后台更新缓存（可选）
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        // 检查是否成功
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      }).catch(() => {
        // 如果网络错误且无缓存，对于 HTML 页面可以返回离线提示页
        // 这里简单处理
      });

      return cachedResponse || fetchPromise;
    })
  );
});
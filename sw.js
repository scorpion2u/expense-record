// sw.js
const CACHE_NAME = 'expense-record-v3'; // 升级版本号强制更新

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
      console.log('✅ 缓存已打开');
      return cache.addAll(urlsToCache);
    })
  );
  self.skipWaiting();
});

// 激活事件
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑 删除旧缓存:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// 请求拦截
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // 有缓存直接返回，同时后台更新
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        }).catch(() => {});
        
        return cachedResponse;
      }

      // 无缓存，尝试网络请求
      return fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // 网络失败且无缓存，返回首页（如果是 HTML 请求）
          if (event.request.headers.get('accept')?.includes('text/html')) {
            return caches.match('/expense-record/');
          }
          // 其他资源（图片等）静默失败
          return new Response('离线不可用', { status: 503 });
        });
    })
  );
});
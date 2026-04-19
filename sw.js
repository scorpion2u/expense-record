// 自动缓存版 sw.js - 修复模块加载问题
const CACHE_NAME = 'expense-cache-v3';  // 👈 改了版本号，强制更新

// 核心文件列表
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
      .then(cache => {
        console.log('开始缓存核心文件...');
        // 逐个添加，确保每个都成功
        return Promise.all(
          CORE_FILES.map(url => {
            return cache.add(url).catch(err => {
              console.error('缓存失败:', url, err);
            });
          })
        );
      })
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
  
  // 对于页面导航请求，网络优先
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          return caches.match(event.request) || caches.match('./index.html');
        })
    );
    return;
  }
  
  // 对于 JS 和 CSS 文件，缓存优先
  if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) {
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
    return;
  }
  
  // 其他请求
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => cachedResponse || fetch(event.request))
  );
});
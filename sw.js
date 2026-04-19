// sw.js - 离线缓存配置文件
const CACHE_NAME = 'expense-tracker-v1';
// 需要缓存的所有文件列表，请根据您项目的实际文件名调整
const urlsToCache = [
  '/expense-record/',
  '/expense-record/index.html',
  '/expense-record/css/styles.css', // 请替换为实际CSS路径
  '/expense-record/js/app.js',     // 请替换为实际JS路径
  '/expense-record/manifest.json'  // 建议添加Web App Manifest以获得更好体验
];

// 安装事件：预缓存关键资源
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

// 激活事件：清理旧缓存
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(name => name !== CACHE_NAME).map(name => caches.delete(name))
      );
    })
  );
});

// 请求拦截：优先使用缓存，同时后台更新
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // 命中缓存，直接返回，同时发起网络请求更新缓存（后台静默更新）
        const fetchPromise = fetch(event.request).then(networkResponse => {
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, networkResponse.clone()));
          return networkResponse;
        });
        return response || fetchPromise;
      })
  );
});          .map(name => caches.delete(name))
      );
    })
  );
});

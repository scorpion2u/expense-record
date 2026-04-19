// 更新后的 sw.js - 增强缓存策略
const CACHE_NAME = 'accounting-book-v2'; // 更新版本号以强制刷新

// 请根据您的项目根路径调整，如果是本地根目录，用 '/' 即可
const BASE_PATH = '/expense-record/'; // 如果部署在根目录，改为 '/'

const urlsToCache = [
  BASE_PATH,
  BASE_PATH + 'index.html',
  BASE_PATH + 'css/styles.css',
  BASE_PATH + 'js/constants.js',
  BASE_PATH + 'js/db.js',
  BASE_PATH + 'js/utils.js',
  BASE_PATH + 'js/modal.js',
  BASE_PATH + 'js/ui.js',
  BASE_PATH + 'js/events.js',
  BASE_PATH + 'js/app.js',
  BASE_PATH + 'manifest.json',
  BASE_PATH + 'icon-192.png',
  BASE_PATH + 'icon-512.png'
];

// 安装事件：预缓存所有核心文件
self.addEventListener('install', event => {
  console.log('🔧 Service Worker 正在安装...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('📦 正在缓存文件:', urlsToCache);
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('✅ 所有核心文件已缓存，离线可用！');
        return self.skipWaiting(); // 立即激活
      })
      .catch(error => {
        console.error('❌ 缓存失败，请检查文件路径或网络:', error);
      })
  );
});

// 激活事件：清理旧缓存
self.addEventListener('activate', event => {
  console.log('🚀 Service Worker 已激活');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(name => name !== CACHE_NAME).map(name => {
          console.log('🗑️ 删除旧缓存:', name);
          return caches.delete(name);
        })
      );
    }).then(() => self.clients.claim()) // 立即控制所有客户端
  );
});

// 请求拦截：网络优先，失败时使用缓存
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // 网络请求成功，将响应克隆并存入缓存
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseClone);
        });
        return response;
      })
      .catch(() => {
        // 网络失败，尝试从缓存中匹配
        return caches.match(event.request).then(cachedResponse => {
          if (cachedResponse) {
            console.log('🔄 使用缓存:', event.request.url);
            return cachedResponse;
          }
          // 如果请求的是页面，返回缓存的 index.html（适用于 SPA）
          if (event.request.mode === 'navigate') {
            return caches.match(BASE_PATH + 'index.html');
          }
          // 离线且无缓存
          console.warn('⚠️ 离线且无缓存:', event.request.url);
          return new Response('离线状态下无法访问此资源。', {
            status: 408,
            headers: {'Content-Type': 'text/plain'}
          });
        });
      })
  );
});
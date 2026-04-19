// sw.js - 离线缓存配置文件（针对当前项目结构优化）
const CACHE_NAME = 'expense-tracker-v2'; // 更新版本号以强制刷新缓存

// 根据您的文件结构，列出所有需要缓存的核心文件
const urlsToCache = [
  '/expense-record/', // 改为您的实际部署路径
  '/expense-record/index.html',
  '/expense-record/css/styles.css',
  '/expense-record/js/constants.js',
  '/expense-record/js/db.js',
  '/expense-record/js/utils.js',
  '/expense-record/js/modal.js',
  '/expense-record/js/ui.js',
  '/expense-record/js/app.js',
  '/expense-record/js/events.js',
  '/expense-record/manifest.json',
  '/expense-record/icon-192.png',
  '/expense-record/icon-512.png'
];

// 安装事件：预缓存关键资源
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('缓存已打开');
        return cache.addAll(urlsToCache);
      })
      .catch(err => console.error('缓存添加失败:', err))
  );
});

// 激活事件：清理旧版本缓存
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(name => name !== CACHE_NAME).map(name => {
          console.log('删除旧缓存:', name);
          return caches.delete(name);
        })
      );
    })
  );
});

// 请求拦截：优先使用缓存，同时后台更新（网络优先策略更适合记账应用的数据更新）
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // 发起网络请求，用于更新缓存
        const fetchPromise = fetch(event.request).then(networkResponse => {
          // 检查是否成功获取
          if (!networkResponse || networkResponse.status !== 200) {
            return networkResponse;
          }
          // 将新获取的资源存入缓存（克隆响应，因为响应流只能读取一次）
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
          return networkResponse;
        }).catch(() => {
          // 网络请求失败（离线时），如果缓存也没有，则返回缓存或错误
          console.log('离线，使用缓存:', event.request.url);
        });
        // 如果有缓存，立即返回；否则等待网络请求
        return cachedResponse || fetchPromise;
      })
  );
});
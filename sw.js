const CACHE_NAME = 'expense-github-v4'; // ⚠️ 每次发布新版本，把这个数字 +1

const STATIC_ASSETS = [
  '/expense-record/',
  '/expense-record/index.html',
  '/expense-record/manifest.json',
  '/expense-record/icon-192.png',
  '/expense-record/icon-512.png'
];

// 需要"网络优先"的请求（页面本体，保证用户总能拿到最新 UI）
const NETWORK_FIRST_PATHS = [
  '/expense-record/',
  '/expense-record/index.html'
];

// 安装：预缓存静态资源
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

// 激活：清理旧版本缓存，立即接管所有已打开的页面
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      )
    )
  );
  self.clients.claim();
});

// 请求拦截
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const isNetworkFirst =
    event.request.mode === 'navigate' ||
    NETWORK_FIRST_PATHS.includes(url.pathname);

  if (isNetworkFirst) {
    // 网络优先：先尝试拿最新的 index.html，成功就更新缓存；失败（离线）才用缓存兜底
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        try {
          const res = await fetch(event.request);
          if (res && res.status === 200) {
            cache.put(event.request, res.clone());
          }
          return res;
        } catch (err) {
          const cached = await cache.match(event.request);
          return cached || cache.match('/expense-record/index.html');
        }
      })()
    );
    return;
  }

  // 其他静态资源（图标等）：缓存优先，加快加载、支持离线
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(event.request);
      if (cached) return cached;

      try {
        const res = await fetch(event.request);
        if (res && res.status === 200) {
          cache.put(event.request, res.clone());
        }
        return res;
      } catch (err) {
        return cache.match('/expense-record/index.html');
      }
    })()
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // 对 HTML 页面使用 Network First 策略
  if (event.request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(event.request);
        })
    );
    return;
  }
  
  // 对所有其他请求（JS、CSS等）使用 Cache First，但忽略查询参数
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true })
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
      .catch(() => {
        // 如果缓存和网络都失败，对于 JS 模块可以尝试忽略路径的匹配
        if (url.pathname.endsWith('.js')) {
          return caches.match(event.request, { ignoreSearch: true, ignoreMethod: true });
        }
      })
  );
});
// 最小化测试 sw.js
self.addEventListener('install', () => {
  self.skipWaiting(); // 强制立即激活
});

self.addEventListener('activate', event => {
  event.waitUntil(clients.claim()); // 立即控制所有页面
});

self.addEventListener('fetch', event => {
  // 简单返回一个离线提示页面，用于测试SW是否工作
  event.respondWith(
    new Response('<h1>离线模式测试成功！Service Worker 已接管网络请求。</h1>', {
      headers: { 'Content-Type': 'text/html' }
    })
  );
});
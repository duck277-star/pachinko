const CACHE_NAME = 'pachinko-cache-v2';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg'
];
const MATTER_URL = 'https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.19.0/matter.min.js';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(APP_SHELL).then(() =>
        // 物理引擎在 CDN 上，一併快取才能真正離線遊玩；CDN 暫時連不上也不要讓安裝失敗
        cache.add(MATTER_URL).catch(() => {})
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

function putInCache(request, response) {
  const clone = response.clone();
  caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  // 頁面本身用「網路優先」：有網路時一定拿到最新版，離線才退回快取
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) putInCache(request, response);
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          const sameOrigin = request.url.startsWith(self.location.origin);
          if ((sameOrigin && response.ok) || request.url === MATTER_URL) putInCache(request, response);
          return response;
        })
        .catch(() => cached);
    })
  );
});

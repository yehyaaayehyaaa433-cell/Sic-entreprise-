/* ============================================================
   SIC Enterprise - Service Worker
   PWA Offline Support
   ============================================================ */

const CACHE_NAME = 'sic-enterprise-v1.0.0';
const RUNTIME_CACHE = 'sic-runtime-v1.0.0';

// الملفات الأساسية التي يجب تخزينها
const PRECACHE_URLS = [
  './',
  './index.html',
  './style.css',
  './data.js',
  './app.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// المكتبات الخارجية (CDN)
const CDN_URLS = [
  'https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap',
  'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js',
  'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js'
];

// ============ INSTALL ============
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pre-caching app shell');
      // نخزن الملفات المحلية
      return cache.addAll(PRECACHE_URLS).catch(err => {
        console.warn('[SW] Some files failed to cache:', err);
      });
    }).then(() => {
      // نخزن المكتبات الخارجية بشكل منفصل (لا نوقف التثبيت إذا فشلت)
      return caches.open(RUNTIME_CACHE).then((cache) => {
        return Promise.all(
          CDN_URLS.map(url =>
            cache.add(url).catch(err => console.warn('[SW] CDN failed:', url))
          )
        );
      });
    }).then(() => self.skipWaiting())
  );
});

// ============ ACTIVATE ============
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
        .filter(name => name !== CACHE_NAME && name !== RUNTIME_CACHE)
        .map(name => {
          console.log('[SW] Deleting old cache:', name);
          return caches.delete(name);
        })
      );
    }).then(() => self.clients.claim())
  );
});

// ============ FETCH ============
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // تجاهل الطلبات غير GET
  if (request.method !== 'GET') return;
  
  // تجاهل chrome-extension وغيرها
  if (!url.protocol.startsWith('http')) return;
  
  // استراتيجية Cache First للملفات المحلية
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        
        return fetch(request).then((response) => {
          // نحفظ نسخة للاستخدام لاحقاً
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        }).catch(() => {
          // إذا فشل الطلب (offline) وطلب HTML → أعد index.html
          if (request.mode === 'navigate' || request.destination === 'document') {
            return caches.match('./index.html');
          }
        });
      })
    );
    return;
  }
  
  // استراتيجية Stale-While-Revalidate للـ CDN
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request).then((response) => {
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      }).catch(() => cached);
      
      return cached || fetchPromise;
    })
  );
});

// ============ MESSAGE ============
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ============ BACKGROUND SYNC (للتحديثات المستقبلية) ============
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-data') {
    console.log('[SW] Background sync triggered');
  }
});

// ============ PUSH NOTIFICATIONS (للمستقبل) ============
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'SIC Enterprise';
  const options = {
    body: data.body || 'لديك إشعار جديد',
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    dir: 'rtl',
    lang: 'ar'
  };
  event.waitUntil(self.registration.showNotification(title, options));
});
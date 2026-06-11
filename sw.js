// EduManage Service Worker — offline support & caching
const CACHE_NAME  = 'edumanage-v3-tenants';
const ASSETS_CACHE = 'edumanage-assets-v3-tenants';

// Core shell assets to cache immediately
const SHELL_ASSETS = [
  './',
  './index.html',
  './css/variables.css',
  './css/base.css',
  './css/layout.css',
  './css/components.css',
  './css/pages.css',
  './css/animations.css',
  './css/skeleton.css',
  './assets/edumanage-mark.svg',
];

// ── Install: cache shell ────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

// ── Activate: clean old caches ──────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME && k !== ASSETS_CACHE).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: network-first for API, cache-first for assets ────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Skip Firebase & external API calls — always network
  if (url.hostname.includes('firebase') ||
      url.hostname.includes('googleapis') ||
      url.hostname.includes('cloudinary') ||
      url.protocol === 'chrome-extension:') {
    return;
  }

  // HTML pages — network first, fallback to cache
  if (event.request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // JS / CSS / Images — cache first
  if (url.pathname.match(/\.(js|css|svg|png|jpg|jpeg|webp|woff2?)$/)) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(res => {
          const clone = res.clone();
          caches.open(ASSETS_CACHE).then(c => c.put(event.request, clone));
          return res;
        });
      })
    );
    return;
  }
});

// ── Push notifications (if backend sends) ───────────────────────────
self.addEventListener('push', event => {
  const data = event.data?.json() || {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'EduManage', {
      body:    data.body    || '',
      icon:    './assets/edumanage-mark.svg',
      badge:   './assets/edumanage-mark.svg',
      tag:     data.tag     || 'edumanage',
      data:    data.url     || './',
      dir:     'rtl',
      lang:    'ar',
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data || '/')
  );
});

/* ============================================================================
   sw.js — Service Worker: offline-first caching (app shell + CDN libraries)
   Strategy:
   - App shell (HTML/CSS/JS/icons): cache-first, falling back to network,
     with background revalidation so updates are picked up on next load.
   - CDN libraries (Tailwind, Chart.js, Dexie): cache-first with network
     fallback, so the app keeps working fully offline after first visit.
   - Navigation requests fall back to the cached index.html when offline
     (classic SPA offline fallback).
   ========================================================================= */

const CACHE_NAME = 'bms-cache-v4';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/i18n.js',
  './js/db.js',
  './js/auth.js',
  './js/sync.js',
  './js/utils.js',
  './js/charts.js',
  './js/print.js',
  './js/app.js',
  './js/app-finance.js',
  './js/app-reports.js',
  './js/app-admin.js',
  './js/app-inventory.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

const CDN_ASSETS = [
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js',
  'https://unpkg.com/dexie@3.2.7/dist/dexie.js',
  'https://cdn.socket.io/4.7.5/socket.io.min.js',
  'https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali:wght@400;600;700&display=swap'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.addAll(CORE_ASSETS);
      // Cache CDN assets individually so one failure doesn't block install
      await Promise.all(CDN_ASSETS.map(url =>
        fetch(url, { mode: 'no-cors' }).then(res => cache.put(url, res)).catch(() => {})
      ));
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // Never intercept calls to a backend sync server (any /api/* path, on any
  // origin) — those must always hit the network live, never be served from
  // cache, or "pull" would return stale/cached data instead of fresh sync
  // results. Let the browser handle these requests normally.
  const url = new URL(req.url);
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io/')) return;

  // Navigation requests (loading the app itself): try network, fallback to cache
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(req, copy));
        return res;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Only cache-first the known app shell + CDN library assets. Anything
  // else (e.g. a request to an arbitrary third-party backend) is left to
  // pass straight through to the network untouched.
  const isKnownAsset = CORE_ASSETS.some(a => req.url.endsWith(a.replace('./', '/'))) || CDN_ASSETS.some(a => req.url.startsWith(a.split('?')[0]));
  if (!isKnownAsset) return;

  event.respondWith(
    caches.match(req).then(cached => {
      const networkFetch = fetch(req).then(res => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || networkFetch;
    })
  );
});

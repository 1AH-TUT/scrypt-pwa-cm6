const CACHE = 'cm6-v1.002';
const ASSETS = [
  'index.html',
  'manifest.webmanifest',
  'importmap.js',
  'styles/theme.css',
  'src/router.js',
  'src/main.js',
  'src/db.js',
  'src/sample-script.js',
  'src/editor-setup.js',
  'src/pages/editor.js',
  'src/pages/library.js',
  'src/pages/splash.js',
  'assets/icons/apple-touch-icon.png',
  'assets/icons/favicon-32.png',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'assets/fonts/CourierPrime.ttf',
  'assets/fonts/CourierPrime-Italic.ttf',
  'assets/fonts/CourierPrime-Bold.ttf',
  'assets/fonts/CourierPrime-BoldItalic.ttf',
  'assets/fonts/CourierPrimeSans.ttf',
  'assets/fonts/CourierPrimeSans-Italic.ttf',
  'assets/fonts/CourierPrimeSans-Bold.ttf',
  'assets/fonts/CourierPrimeSans-BoldItalic.ttf'
];

// During install, cache the app shell
self.addEventListener('install', evt => {
  evt.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

// Clean up old caches on activate
self.addEventListener('activate', evt => {
  evt.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

// Intercept fetch requests
self.addEventListener('fetch', evt => {
  const { request } = evt;

  // Cache JSPM CDN ESM files as well as app shell
  if (request.url.startsWith('https://ga.jspm.io/')) {
    evt.respondWith(
      caches.open(CACHE).then(cache =>
        cache.match(request).then(response =>
          response || fetch(request).then(resp => {
            // Only cache if fetch succeeds (status 200)
            if (resp.ok) cache.put(request, resp.clone());
            return resp;
          })
        )
      )
    );
    return;
  }

  // App shell
  if (request.method !== 'GET' || request.url.startsWith('chrome-extension')) return;
  evt.respondWith(
    caches.match(request).then(cached => cached || fetch(request))
  );
});

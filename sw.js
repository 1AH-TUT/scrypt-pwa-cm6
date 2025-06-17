const CACHE = 'cm6-v1.008';
const ASSETS = [
  'index.html',
  'manifest.webmanifest',
  'importmap.js',
  'styles/theme.css',

  // Main App JS
  'src/main.js',
  'src/router.js',
  'src/widget-host.js',

  // Components
  'src/components/app-sidebar.js',
  'src/components/edit-base.js',
  'src/components/edit-action.js',
  'src/components/edit-transition.js',
  'src/components/edit-scene-heading.js',
  'src/components/edit-dialogue.js',

  // Controllers
  'src/controllers/editor-controller.js',

  // Data Layer
  'src/data-layer/db.js',
  'src/data-layer/validator.js',
  'src/data-layer/schema_v0.1.json',

  // Pages
  'src/pages/index.js',
  'src/pages/editor.js',
  'src/pages/library.js',
  'src/pages/splash.js',

  // Scrypt logic
  'src/scrypt/element-utils.js',
  'src/scrypt/scrypt.js',
  'src/scrypt/default-options.js',

  // State
  'src/state/current-scrypt.js',
  'src/state/state.js',

  // Views
  'src/views/editor-view.js',
  'src/views/editor-view-themes.js',

  // Fonts
  'assets/fonts/CourierPrime.ttf',
  'assets/fonts/CourierPrime-Italic.ttf',
  'assets/fonts/CourierPrime-Bold.ttf',
  'assets/fonts/CourierPrime-BoldItalic.ttf',
  'assets/fonts/CourierPrime.woff2',
  'assets/fonts/CourierPrime-Italic.woff2',
  'assets/fonts/CourierPrime-Bold.woff2',
  'assets/fonts/CourierPrime-BoldItalic.woff2',
  'assets/fonts/CourierPrimeSans.woff2',
  'assets/fonts/CourierPrimeSans-Italic.woff2',
  'assets/fonts/CourierPrimeSans-Bold.woff2',
  'assets/fonts/CourierPrimeSans-BoldItalic.woff2',

  // Icons
  'assets/icons/apple-touch-icon.png',
  'assets/icons/favicon-32.png',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png'
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

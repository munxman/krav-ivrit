const scope = new URL(self.registration.scope);
const cachePrefix = `krav-ivrit:${scope.href}:`;
// Increase after changing any of the packaged files below.
const cacheName = `${cachePrefix}v1`;
const shell = new URL('index.html', scope);
const files = new Set([
  'index.html',
  'styles.css',
  'app.mjs',
  'engine.mjs',
  'data/terms.json',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
].map(path => new URL(path, scope).href));

self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache => {
    return cache.addAll(Array.from(files, url => new Request(url, { cache: 'reload' })));
  }));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(cachePrefix) && key !== cacheName)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;

  const isAppNavigation = request.mode === 'navigate'
    && (url.pathname === scope.pathname || url.pathname === shell.pathname);
  const cacheKey = isAppNavigation ? shell.href : url.href;
  if (!files.has(cacheKey)) return;

  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    return await cache.match(cacheKey) || fetch(request);
  })());
});

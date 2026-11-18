const scope = new URL(self.registration.scope);
const cachePrefix = `krav-ivrit:${scope.href}:`;
// Increase after changing any packaged file or recording.
const cacheName = `${cachePrefix}v4`;
const shell = new URL('index.html', scope);
const audioBase = new URL('audio/', scope);
const files = new Set([
  'index.html',
  'styles.css',
  'app.mjs',
  'engine.mjs',
  'data/terms.json',
  'audio/manifest.json',
  'audio/README.md',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
].map(path => new URL(path, scope).href));

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(cacheName);
    await cache.addAll(Array.from(files, url => new Request(url, { cache: 'reload' })));
    const manifest = await (await cache.match(new URL('manifest.json', audioBase))).json();
    const clips = Object.values(manifest.clips);
    if (!clips.length || !clips.every(clip => /^[a-z0-9-]+\.mp3$/.test(clip.file))) {
      throw new Error('Invalid audio pack');
    }
    await cache.addAll(clips.map(clip => new Request(new URL(clip.file, audioBase), { cache: 'reload' })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(cachePrefix) && key !== cacheName)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type === 'offline-status') {
    event.ports?.[0]?.postMessage({ version: 4, audio: true });
  }
});

// Adapted from Study Pocket's audio range handling for Safari offline playback.
async function partialAudio(response, header) {
  const bytes = await response.arrayBuffer();
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  const size = bytes.byteLength;
  let start = NaN;
  let end = NaN;
  if (match && (match[1] || match[2])) {
    start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
    end = match[1] && match[2] ? Math.min(size - 1, Number(match[2])) : size - 1;
  }
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= size || end < start) {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
  }
  return new Response(bytes.slice(start, end + 1), {
    status: 206,
    headers: {
      'Content-Type': 'audio/mpeg',
      'Content-Length': String(end - start + 1),
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Accept-Ranges': 'bytes',
    },
  });
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  const isClip = url.href.startsWith(audioBase.href) && /^[a-z0-9-]+\.mp3$/.test(url.href.slice(audioBase.href.length));
  const isAppNavigation = request.mode === 'navigate'
    && (url.pathname === scope.pathname || url.pathname === shell.pathname);
  const cacheKey = isAppNavigation ? shell.href : url.href;
  if (!files.has(cacheKey) && !isClip) return;
  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    const hit = await cache.match(cacheKey);
    if (hit) {
      if (isClip && request.headers.has('range')) return partialAudio(hit, request.headers.get('range'));
      return hit;
    }
    return fetch(request);
  })());
});

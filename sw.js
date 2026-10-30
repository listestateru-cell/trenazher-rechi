/* Кеш содержит только явные публичные ресурсы оболочки, никогда личные данные. */
'use strict';
const ROOT_URL = new URL('./', self.registration.scope);
const CACHE_PREFIX = 'speech-shell-' + encodeURIComponent(ROOT_URL.pathname) + '-';
const CACHE_NAME = CACHE_PREFIX + '7b868df38dc41b87cff4';
const PRECACHE = ["./", "./admin.css", "./admin.js", "./app.js", "./assessment.css", "./assessment.js", "./audio-retention.js", "./characters/bugs.webp", "./characters/chip.webp", "./characters/crash.webp", "./characters/credits.html", "./characters/dale.webp", "./characters/darkwing.webp", "./characters/donatello.webp", "./characters/gadget.webp", "./characters/huey.webp", "./characters/jerry.webp", "./characters/kim.webp", "./characters/leonardo.webp", "./characters/lola.webp", "./characters/mario.webp", "./characters/monterey-jack.webp", "./characters/mr-krabs.webp", "./characters/patrick.webp", "./characters/plankton.webp", "./characters/sailor-moon.webp", "./characters/scrooge.webp", "./characters/sonic.webp", "./characters/spongebob.webp", "./characters/tom.webp", "./characters/zipper.webp", "./connection-config.js", "./connection.css", "./connection.js", "./conversations.css", "./conversations.js", "./drafts.js", "./duels.css", "./duels.js", "./groups.css", "./groups.js", "./guide-audio/clarify-choices.m4a", "./guide-audio/clarify-feedback.m4a", "./guide-audio/clarify-first-answer.m4a", "./guide-audio/clarify-intro.m4a", "./guide-audio/clarify-revision.m4a", "./guide-audio/clarify-source.m4a", "./guide-audio/clarify-transfer.m4a", "./guide-audio/lexicon-choices.m4a", "./guide-audio/lexicon-feedback.m4a", "./guide-audio/lexicon-first-answer.m4a", "./guide-audio/lexicon-intro.m4a", "./guide-audio/lexicon-revision.m4a", "./guide-audio/lexicon-source.m4a", "./guide-audio/lexicon-transfer.m4a", "./guide-audio/manifest.json", "./guide-audio/synonyms-choices.m4a", "./guide-audio/synonyms-feedback.m4a", "./guide-audio/synonyms-first-answer.m4a", "./guide-audio/synonyms-intro.m4a", "./guide-audio/synonyms-revision.m4a", "./guide-audio/synonyms-source.m4a", "./guide-audio/synonyms-transfer.m4a", "./icons/apple-touch-icon.png", "./icons/icon-180.png", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/icon-maskable-512.png", "./icons/icon-maskable.svg", "./icons/icon.svg", "./learning-guide-content.js", "./learning-guide.js", "./lessons.css", "./lessons.js", "./manifest.webmanifest", "./mobile.css", "./mobile.js", "./profiles.css", "./profiles.js", "./program-ui.css", "./program-ui.js", "./style.css", "./training-ui.css", "./training-ui.js"];
const SHELL_URL = ROOT_URL.href;
const ASSETS = new Set(PRECACHE.filter(path => path !== './').map(path => new URL(path, ROOT_URL).href));

self.addEventListener('install', event => {
  const resources = PRECACHE.map(path => new Request(new URL(path, ROOT_URL).href, { cache: 'reload' }));
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(resources)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const address = new URL(request.url);
  if (request.method !== 'GET' || address.origin !== ROOT_URL.origin || request.headers.has('Authorization')) return;
  if (address.pathname.endsWith('/url.txt') || /\/(?:api|media|u)\//.test(address.pathname)) return;
  const navigation = request.mode === 'navigate' && [ROOT_URL.pathname, ROOT_URL.pathname + 'index.html'].includes(address.pathname);
  if (navigation) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await fetch(request, { cache: 'no-cache' });
        if (response.ok && (response.headers.get('Content-Type') || '').includes('text/html')) {
          await cache.put(SHELL_URL, response.clone());
          return response;
        }
        return await cache.match(SHELL_URL) || response;
      } catch (error) {
        const saved = await cache.match(SHELL_URL);
        if (saved) return saved;
        throw error;
      }
    })());
    return;
  }
  address.search = ''; address.hash = '';
  if (!ASSETS.has(address.href)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      const response = await fetch(request, { cache: 'no-cache' });
      // Partial audio responses cannot replace a complete public resource.
      if (response.ok) {
        if (response.status === 200 && response.type === 'basic') await cache.put(address.href, response.clone());
        return response;
      }
      return await cache.match(address.href) || response;
    } catch (error) {
      const saved = await cache.match(address.href);
      if (saved) return saved;
      throw error;
    }
  })());
});

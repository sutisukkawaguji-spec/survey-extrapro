const CACHE_NAME = 'survey-pro-v2';
const urlsToCache = [
    './',
    './index.html',
    './manifest.json',
    './config.js',
    './icon.png'
];

self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(response => response || fetch(event.request))
    );
});

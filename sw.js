// ---- service worker: the whole game, kept on the device ----
// There is no build step and no runtime data, so the app shell IS the app:
// precache every file at install and serve from the cache. Bump VERSION when
// you ship, which is what evicts the old copy.
'use strict';

const VERSION = 'labyrinth-v2';

const SHELL = [
  './',
  'index.html',
  'style.css',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
  'js/engine/util.js',
  'js/engine/font.js',
  'js/engine/synth.js',
  'js/engine/grid.js',
  'js/engine/raycaster.js',
  'js/engine/input.js',
  'js/game/tiles.js',
  'js/game/config.js',
  'js/game/items.js',
  'js/game/shops.js',
  'js/game/textures.js',
  'js/game/sprites.js',
  'js/game/sfx.js',
  'js/game/dungeon.js',
  'js/game/overworld.js',
  'js/game/daynight.js',
  'js/game/quests.js',
  'js/game/save.js',
  'js/game/projectiles.js',
  'js/game/actors.js',
  'js/game/ui.js',
  'js/game/menus.js',
  'js/game/main.js',
  'js/game/touch.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    // reload, not the HTTP cache: a stale entry here would be baked in for good
    await cache.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith((async () => {
    // a navigation always lands on the shell, so a deep link still opens the game
    const hit = await caches.match(req.mode === 'navigate' ? 'index.html' : req, {
      ignoreSearch: req.mode === 'navigate',
    });
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res.ok) (await caches.open(VERSION)).put(req, res.clone());
      return res;
    } catch (err) {
      // offline and not in the cache: nothing to serve but the failure
      return Response.error();
    }
  })());
});

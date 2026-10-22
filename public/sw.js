/*
 * FPL Lineup service worker: opens the planner, fixtures and scout offline.
 *
 * - Pages (/, /fixtures, /scout): network first, so a new release is picked up on
 *   the next launch; the cached copy answers when offline or after 3 s.
 * - /_next/static and /icons: content-hashed, so cache first. Precached from
 *   the pages' HTML on install; chunks loaded before this worker took control
 *   are sent over by the page (see PwaSetup).
 * - Past gameweeks (/api/team/{id}/picks/{gw}): network first, cached for offline.
 * - Player photos (/api/photo): served from cache, refreshed in the background.
 * Game data, teams and plans live in IndexedDB, so they need nothing here.
 */

const VERSION = "v1";
const SHELL = `shell-${VERSION}`;
const STATIC = "static"; // hashed URLs never change, so this survives new versions
const RUNTIME = `runtime-${VERSION}`;
const PAGES = ["/", "/fixtures", "/scout"];
const STATIC_LIMIT = 400;
const PAGE_TIMEOUT_MS = 3000;

self.addEventListener("install", (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = [SHELL, STATIC, RUNTIME];
      for (const name of await caches.keys()) if (!keep.includes(name)) await caches.delete(name);
      await trim(STATIC, STATIC_LIMIT);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "cache" && Array.isArray(event.data.urls)) {
    event.waitUntil(cacheStatic(event.data.urls));
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") event.respondWith(page(request, url));
  else if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(cacheFirst(request));
  } else if (/^\/api\/team\/\d+\/picks\/\d+$/.test(url.pathname)) event.respondWith(networkFirst(request));
  else if (url.pathname.startsWith("/api/photo/")) event.respondWith(staleWhileRevalidate(request));
});

/** Both pages' HTML, plus every hashed script, stylesheet and font they reference. */
async function precache() {
  const shell = await caches.open(SHELL);
  const assets = new Set();
  await Promise.all(
    PAGES.map(async (path) => {
      const res = await fetch(path, { cache: "no-cache" });
      if (!res.ok) return;
      const html = await res.clone().text();
      await shell.put(path, res);
      for (const m of html.matchAll(/\/_next\/static\/[^"'\s\\)]+/g)) assets.add(m[0]);
    }),
  );
  await cacheStatic([...assets]);
}

async function cacheStatic(urls) {
  const cache = await caches.open(STATIC);
  await Promise.all(
    urls
      .map((u) => new URL(u, self.location.origin))
      .filter((u) => u.origin === self.location.origin && u.pathname.startsWith("/_next/static/"))
      .map(async (u) => {
        if (await cache.match(u.pathname)) return;
        const res = await fetch(u.pathname).catch(() => null);
        if (res?.ok) await cache.put(u.pathname, res);
      }),
  );
}

async function page(request, url) {
  const key = PAGES.includes(url.pathname) ? url.pathname : null;
  const cache = await caches.open(SHELL);
  const network = fetch(request).then((res) => {
    if (res.ok && key) void cache.put(key, res.clone());
    return res;
  });
  // Both pages are the same app shell, so either will do offline.
  const cached = (key && (await cache.match(key))) || (await cache.match("/"));
  if (!cached) return network;
  const timeout = new Promise((resolve) => setTimeout(() => resolve(cached), PAGE_TIMEOUT_MS));
  return Promise.race([network.catch(() => cached), timeout]);
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC);
  const hit = await cache.match(request, { ignoreSearch: true });
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) void cache.put(request, res.clone());
  return res;
}

async function networkFirst(request) {
  const cache = await caches.open(RUNTIME);
  try {
    const res = await fetch(request);
    if (res.ok) void cache.put(request.url, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(request.url);
    if (hit) return hit;
    throw err;
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME);
  const hit = await cache.match(request);
  const network = fetch(request)
    .then((res) => {
      if (res.ok) void cache.put(request, res.clone());
      return res;
    })
    .catch(() => hit ?? Response.error());
  return hit ?? network;
}

/** Drops the oldest entries past `limit` (keys come back in insertion order). */
async function trim(name, limit) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  for (const key of keys.slice(0, Math.max(0, keys.length - limit))) await cache.delete(key);
}

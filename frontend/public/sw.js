/**
 * The service worker.
 *
 * It exists for one thing: a phone. Tasks happen away from a desk, and an app
 * that can only be reached by finding a browser tab loses to whatever is
 * already on the home screen. A worker is what lets this be installed and
 * opened like an application, and what lets it open at all on a train.
 *
 * ## What it will and will not hold
 *
 * **Never the API.** Every `/api/` path is the account's own record, it is
 * what the reader came to see, and a stale copy of it is worse than an honest
 * failure — a dashboard showing yesterday's XP with no sign that it is
 * yesterday's is a lie the reader has no way to catch. Those requests are not
 * touched at all: no cache read, no cache write.
 *
 * **The shell, on the way past.** `/assets/<name>-<hash>.js` is content
 * addressed — a changed file gets a new name — so a hit can be served from
 * cache without checking, and nothing can go stale under a name that is still
 * being asked for. That is the one place cache-first is safe, and it is safe
 * for exactly the reason backend/routes/spa.py gives for caching them forever.
 *
 * **The page, network first.** A navigation asks the network and falls back to
 * the cached shell only when the network is gone. The other way round would
 * pin whatever build was installed first: index.html is the file that names
 * the current hashed bundles, so serving an old one offers an old app.
 *
 * ## Why it does not take over immediately
 *
 * No `skipWaiting`. A new worker waits until every tab on the old build has
 * gone, because activating under a live page means that page's next lazy
 * chunk — a route it has not opened yet, named in the build it was loaded
 * from — is requested after `activate` has deleted the cache holding it. The
 * cost of waiting is that an upgrade lands on the next full visit rather than
 * this one. The cost of not waiting is a blank screen on a route change, which
 * is not a trade worth making for a few minutes.
 */

/* Bumped when anything in this file or PRECACHE changes. The name is the whole
   versioning scheme: `activate` deletes every cache that is not this one, so a
   new value retires the old build in one step. */
const VERSION = 'summit-v1';

/* The least that makes an offline open work: the shell and the things the
   browser fetches on its own before any of the app's code runs. The hashed
   bundles are deliberately absent — their names change every build, so listing
   them here would mean editing this file on every build, and they are picked
   up on first use instead. */
const PRECACHE = ['/', '/manifest.json', '/favicon.ico', '/apple-touch-icon.png'];

/** Shown when a navigation has no network and no cached shell to fall back to. */
const OFFLINE_PAGE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Offline · Summit</title>
<style>
  body { margin:0; min-height:100vh; display:grid; place-items:center;
         background:#f4f5f7; color:#141a22;
         font:16px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { max-width:22rem; padding:2rem; text-align:center; }
  h1 { font-size:1.25rem; margin:0 0 .5rem; }
  p { margin:0; color:#5b6472; }
  @media (prefers-color-scheme: dark) {
    body { background:#0f1420; color:#e7ebf2; } p { color:#9aa4b2; }
  }
</style></head>
<body><main>
  <h1>No connection</h1>
  <p>Summit keeps your record on the server, so it needs the network to show
     it. This page will work again as soon as you are back.</p>
</main></body></html>`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) =>
      /* Individually, and each failure swallowed: `addAll` rejects the whole
         install if any one file 404s, which would mean a single renamed asset
         leaving the app with no worker at all. */
      Promise.all(
        PRECACHE.map((url) => cache.add(url).catch(() => undefined)),
      ),
    ),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))),
      )
      /* Claim only after the old caches are gone, and only ever from a worker
         that waited for the old tabs to close — see the note at the top. */
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Another origin's problem: fonts, and anything else the page reaches for.
  if (url.origin !== self.location.origin) return;
  // The account's own record. Never cached, never served stale — see above.
  if (url.pathname.startsWith('/api/')) return;

  // A page. Network first, cached shell second, the notice above last.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          void caches.open(VERSION).then((cache) => cache.put('/', copy));
          return response;
        })
        .catch(async () => {
          const cached = await caches.match('/');
          return (
            cached
            ?? new Response(OFFLINE_PAGE, {
              status: 503,
              headers: { 'Content-Type': 'text/html; charset=utf-8' },
            })
          );
        }),
    );
    return;
  }

  // A hashed bundle, or one of the files served under a fixed name. Cache
  // first for the former is safe because the name is the version; for the
  // latter the worker's own version is what retires them.
  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit
        ?? fetch(request).then((response) => {
          /* Opaque and error responses are not worth keeping: a cached 404
             outlives the deploy that fixes it. */
          if (response.ok && response.type === 'basic') {
            const copy = response.clone();
            void caches.open(VERSION).then((cache) => cache.put(request, copy));
          }
          return response;
        }),
    ),
  );
});

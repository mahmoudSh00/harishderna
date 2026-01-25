/* Offline micro-server and cache */
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open('pos-cache-v1').then((c) =>
      c.addAll(['./', './index.html'])
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    const c = await caches.open('pos-cache-v1');
    c.put(req, res.clone());
    return res;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

// Simple API demo
async function handleApi(url, req) {
  const path = url.pathname.replace(/^\/+/, '');
  if (path === 'api/ping') return json({ ok: true, ts: Date.now() });
  if (path === 'api/health') return json({ ok: true, scope: self.registration.scope || '' });
  return json({ ok: false, error: 'not_found' }, 404);
}

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(handleApi(url, e.request));
    return;
  }
  if (e.request.method === 'GET') {
    e.respondWith(cacheFirst(e.request));
  }
});

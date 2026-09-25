const CACHE_NAME = 'glavera3-v30';
const CORE_ASSETS = ['./index.html', './manifest.json', './icon-192.png', './icon-512.png', './xo-logo.png', './connect4-logo.png', './domino-logo.png', './ludo-logo.png', './c4-btn-red.webp', './c4-btn-blue.webp', './c4-btn-yellow.webp', './c4-btn-green.webp', './music.mp3'];
const NETWORK_TIMEOUT_MS = 3500; // لو النت ضعيف ومردش الرد خلال المدة دي، هنعرض النسخة المحفوظة فورًا

const OFFLINE_HTML = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>جلافيرا 3</title>
<style>body{font-family:sans-serif;background:#171449;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;padding:24px}
p{max-width:320px;line-height:1.7;font-size:16px}</style></head>
<body><p>مفيش اتصال بالإنترنت دلوقتي، وده أول مرة تفتح فيها التطبيق على الجهاز ده.<br>افتحه مرة واحدة وانت متصل بالنت، وبعد كده هيشتغل من غير نت.</p></body></html>`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(CORE_ASSETS.map((asset) => cache.add(asset).catch(() => {})))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

function timeout(ms) {
  return new Promise((resolve) => setTimeout(() => resolve(null), ms));
}

// استراتيجية: نطلب من النت وفي نفس الوقت نستنى مهلة قصيرة.
// لو النت رد بسرعة: نستخدم رده ونحدّث النسخة المحفوظة.
// لو النت بطيء أو مقطوع: نعرض النسخة المحفوظة فورًا من غير ما نستنى النت يخلص،
// والطلب من النت بيفضل شغال في الخلفية عشان يحدّث النسخة المحفوظة لو خلص لاحقًا.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const req = event.request;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(req);

    const networkFetch = fetch(req, { cache: 'no-store' })
      .then((res) => {
        if (res && res.ok) cache.put(req, res.clone()).catch(() => {});
        return res;
      })
      .catch(() => null);

    const fast = await Promise.race([networkFetch, timeout(NETWORK_TIMEOUT_MS)]);
    if (fast) return fast;

    if (cached) return cached;

    // مفيش نسخة محفوظة: نستنى النت لآخر لحظة (ممكن يكون بس بطيء مش مقطوع)
    const late = await networkFetch;
    if (late) return late;

    if (req.mode === 'navigate') {
      return new Response(OFFLINE_HTML, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
    return new Response('', { status: 503, statusText: 'Offline' });
  })());
});

// لما المستخدم يضغط على إشعار عملية الفيزا: افتح/ركّز التطبيق
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) { if ('focus' in c) return c.focus(); }
      if (self.clients.openWindow) return self.clients.openWindow('./');
    })
  );
});

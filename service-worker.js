/* Service worker: يخزّن التطبيق عشان يفتح بسرعة وبدون نت. غيّر رقم VERSION عند كل تحديث كبير. */
const VERSION = 'glx-v3';
const CORE = ['./', './index.html', './manifest.json', './icon-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION).then((c) => Promise.all(CORE.map((u) => c.add(u).catch(() => {})))).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  /* بيانات Firebase تفضل مباشرة من السيرفر */
  if (/firebaseio\.com|googleapis\.com\/(identitytoolkit|firestore)|firestore\.googleapis/.test(url.host + url.pathname)) return;

  /* الصفحة نفسها: الشبكة أولًا (عشان التحديثات توصل) ولو مفيش نت من الكاش */
  if (req.mode === 'navigate' || url.pathname.endsWith('/index.html')) {
    e.respondWith(
      fetch(req).then((r) => { const cp = r.clone(); caches.open(VERSION).then((c) => c.put('./index.html', cp)); return r; })
        .catch(() => caches.match('./index.html').then((r) => r || caches.match('./')))
    );
    return;
  }

  /* باقي الملفات (خطوط، مكتبات، أيقونات): من الكاش وبتتحدث في الخلفية */
  e.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req).then((r) => {
        if (r && (r.ok || r.type === 'opaque')) { const cp = r.clone(); caches.open(VERSION).then((c) => c.put(req, cp)); }
        return r;
      }).catch(() => hit);
      return hit || net;
    })
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => (cs[0] ? cs[0].focus() : self.clients.openWindow('./'))));
});

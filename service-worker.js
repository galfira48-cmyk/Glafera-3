/* Service worker: يخزّن التطبيق عشان يفتح بسرعة وبدون نت. غيّر رقم VERSION عند كل تحديث كبير. */
const VERSION = 'glx-v4';
const CORE = ['./', './index.html', './manifest.json', './icon-192.png'];
/* مكتبات خارجية لازمة عشان التطبيق يشتغل أوفلاين (بتتخزّن مرة وقت التثبيت) */
const EXTERNAL = [
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-database-compat.js',
  'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.6.2/cropper.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.6.2/cropper.min.css',
  'https://fonts.googleapis.com/css2?family=Cairo:wght@500;700;800;900&family=Tajawal:wght@400;500;700&family=Cormorant+Garamond:ital,wght@1,500;1,600&family=Playfair+Display:ital,wght@0,700;0,800;0,900;1,600&family=Cinzel:wght@600;700&family=Montserrat:wght@500;600&family=IBM+Plex+Mono:wght@500;600&display=swap',
  'https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Aref+Ruqaa:wght@700&display=swap'
];

function fetchWithTimeout(req, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    fetch(req).then((r) => { clearTimeout(t); resolve(r); }, (err) => { clearTimeout(t); reject(err); });
  });
}

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION).then((c) => Promise.all([
      ...CORE.map((u) => c.add(u).catch(() => {})),
      ...EXTERNAL.map((u) => fetch(new Request(u, { mode: 'no-cors' })).then((r) => c.put(u, r)).catch(() => {}))
    ])).then(() => self.skipWaiting())
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

  /* الصفحة نفسها: الشبكة أولًا (عشان التحديثات توصل)، ولو مفيش نت أو النت بطيء (4 ثواني) من الكاش */
  if (req.mode === 'navigate' || url.pathname.endsWith('/index.html')) {
    e.respondWith(
      fetchWithTimeout(req, 4000)
        .then((r) => {
          if (r && r.ok) { const cp = r.clone(); caches.open(VERSION).then((c) => c.put('./index.html', cp)); }
          return r;
        })
        .catch(() => caches.match('./index.html').then((r) => r || caches.match('./') || fetch(req)))
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

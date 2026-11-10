// 홈스터디 서비스 워커: 정적 파일은 캐시 우선, 페이지는 네트워크 우선(오프라인이면 캐시)
const VERSION = "v3";
const STATIC = `hs-static-${VERSION}`;
const PAGES = `hs-pages-${VERSION}`;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(PAGES).then((c) => c.add("/offline.html")));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => ![STATIC, PAGES].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) caches.open(STATIC).then((c) => c.put(req, res.clone()));
            return res;
          }),
      ),
    );
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // 로그인으로 리다이렉트된 응답은 캐시하지 않는다
          if (res.ok && !res.redirected) caches.open(PAGES).then((c) => c.put(req, res.clone()));
          return res;
        })
        // 오프라인: 같은 화면의 저장본(주소 뒤 ?id= 등은 무시) → 없으면 안내 화면
        .catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match("/offline.html"))),
    );
  }
});

// 푸시 알림
self.addEventListener("push", (event) => {
  let data = { title: "홈스터디", body: "", url: "/" };
  try {
    data = { ...data, ...event.data.json() };
  } catch {}
  event.waitUntil(self.registration.showNotification(data.title, { body: data.body, icon: "/icons/icon-192.png", badge: "/icons/icon-192.png", data: { url: data.url } }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ("focus" in c) {
          c.navigate(url);
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});

// 주요 화면과 그 화면이 쓰는 파일을 미리 저장해 둔다 (로그인한 뒤 앱이 요청)
async function warm(routes) {
  const pages = await caches.open(PAGES);
  const statics = await caches.open(STATIC);
  const assets = new Set();
  for (const route of routes) {
    try {
      const res = await fetch(route, { credentials: "same-origin" });
      if (!res.ok || res.redirected) continue;
      const html = await res.clone().text();
      await pages.put(route, res);
      for (const m of html.matchAll(/["'(](\/_next\/static\/[^"')\s\\]+)/g)) assets.add(m[1]);
    } catch {}
  }
  for (const url of assets) {
    try {
      if (await statics.match(url)) continue;
      const res = await fetch(url);
      if (res.ok) await statics.put(url, res);
    } catch {}
  }
}

self.addEventListener("message", (event) => {
  if (event.data?.type === "warm" && Array.isArray(event.data.routes)) event.waitUntil(warm(event.data.routes));
});

// 路線図ひと筆を端末に保存して、電波が無くても遊べるようにする（PWA）。
// 画面は先にネットを見て、つながらないときだけ保存したものを使う（直した版がすぐ届く）。
// 記録（localStorage）には触らない。外へ何も送らない（よそのサイト＝文字の取り寄せは扱わない）。
const CACHE = "rosen-v1";
const SHELL = ["./", "./index.html", "./gen.js", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith("rosen-") && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const fromCache = () => caches.match(req, { ignoreSearch: true })
    .then((hit) => hit || (req.mode === "navigate" ? caches.match("./index.html") : undefined));
  // つながったまま返事が来ないときは、4秒で保存したものに切り替える（保存が無ければネットを待つ）
  e.respondWith(new Promise((resolve) => {
    let sent = false; const send = (r) => { if (!sent) { sent = true; resolve(r); } };
    const slow = setTimeout(() => fromCache().then((hit) => hit && send(hit)), 4000);
    fetch(req).then((res) => {
      clearTimeout(slow);
      if (res.ok) { const copy = res.clone(); e.waitUntil(caches.open(CACHE).then((c) => c.put(req, copy))); return send(res); }
      if (res.status >= 500) return fromCache().then((hit) => send(hit || res));
      send(res);
    }, () => { clearTimeout(slow); fromCache().then((hit) => send(hit || Response.error())); });
  }));
});

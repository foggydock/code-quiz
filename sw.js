const CACHE = "codeq-v2";
// 同じドメイン（foggydock.github.io）の他のアプリとキャッシュの置き場が共通なので、消すのはこの接頭辞の古い版だけにする
const CACHE_PREFIX = "codeq-";
// "./" はホーム画面から開いたときのURL（manifestのstart_url）。index.htmlだけだと初回訪問直後のオフライン起動で見つからない
const ASSETS = ["./", "index.html", "manifest.json"];

self.addEventListener("install", e => {
  // ブラウザのHTTPキャッシュに残った古い版を拾わないよう、必ずサーバーから取り直す
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: "reload" })))));
  self.skipWaiting();
});
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith(CACHE_PREFIX) && k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET" || e.request.url.includes("questions.json")) return; // 常に最新を取りに行く
  e.respondWith(
    caches.match(e.request).then(cached =>
      cached || fetch(e.request).then(res => {
        // エラー応答（404・一時的な500など）は保存しない。一度入ると次の版まで返し続けてしまうため
        if (res.ok && res.type === "basic") {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      }).catch(() =>
        // オフラインでキャッシュに無いページ（?付きURLなど）はアプリ本体で代用する
        e.request.mode === "navigate"
          ? caches.match("index.html").then(r => r || Response.error())
          : Response.error()
      )
    )
  );
});

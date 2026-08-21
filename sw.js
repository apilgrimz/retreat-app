// 부산중부교회 앱 service worker
var VERSION = 'jbc-app-v137'; // ★ 앱을 수정해 다시 올릴 때마다 v3, v4 … 로 숫자를 올리세요
var ASSETS = ['./index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(VERSION).then(function (c) {
      return Promise.all(ASSETS.map(function (f) { return c.add(f).catch(function () {}); }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== VERSION; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () {
      // 예전 버전이 잘못 저장해 둔 '외부 주소' 응답을 지운다.
      // (파이어스토어 실시간 연결이 옛 응답에 막혀 있던 것을 풀어 준다)
      return caches.open(VERSION).then(function (c) {
        return c.keys().then(function (reqs) {
          return Promise.all(reqs.map(function (r) {
            var ok = true;
            try { ok = new URL(r.url).origin === self.location.origin; } catch (err) {}
            return ok ? null : c.delete(r);
          }));
        });
      });
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  // ★ 우리 서버의 파일만 다룬다.
  //   파이어스토어(firestore.googleapis.com)는 실시간 연결을 GET 요청으로 계속 주고받는데,
  //   아래 '캐시 우선' 규칙이 그것까지 가로채 옛 응답을 돌려주면 동기화가 멈춘다.
  //   외부 주소는 손대지 말고 그대로 통과시킨다.
  var url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.origin !== self.location.origin) return;

  var accept = req.headers.get('accept') || '';
  var isHTML = req.mode === 'navigate' || accept.indexOf('text/html') !== -1;

  if (isHTML) {
    // HTML은 '네트워크 우선' → 접속할 때마다 최신 버전을 받음. 오프라인이면 캐시 사용.
    e.respondWith(
      fetch(req, { cache: 'no-store' }).then(function (resp) {
        var copy = resp.clone();
        caches.open(VERSION).then(function (c) { c.put('./index.html', copy); });
        return resp;
      }).catch(function () {
        return caches.match('./index.html', { ignoreSearch: true });
      })
    );
    return;
  }

  // 그 외 정적 파일: 캐시 우선 + 백그라운드 갱신
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(function (cached) {
      var network = fetch(req).then(function (resp) {
        var copy = resp.clone();
        caches.open(VERSION).then(function (c) { c.put(req, copy); });
        return resp;
      }).catch(function () { return cached; });
      return cached || network;
    })
  );
});

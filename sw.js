// 하계수양회 PWA Service Worker
// v11.9.1 — 종합 통계 재설계: 홈 접힘 카드, 인쇄 통합 표(한 장) // 종합 통계(홈 카드+현황 인쇄): 차수·구역·회 × 참석/전도/침례, 분포표 침례 열 // 인쇄 열폭 조정: 차수·비고 축소, 교통편 확대(숙소 칸 침범 방지) // 차수 칸 두 개씩 줄바꿈(화면·사진·인쇄), 본대 배정 상/하행 겹침 수정 // 인쇄 v10: 앞장 몫 max(25,균등올림)·잔여는 마지막 장(110→28·28·28·26, 34→25·9) // 인쇄 v9: 배분 유지 + 앞장 행간 채움(마지막 장은 같은 행간·미채움) // 확인란 유령 체크 이관 수정, 본대 배정 구역 접힘, 미배정 차수별 2단 // 인쇄 v8: 33명(가중치) 상한 균등 분배·자연 렌더(잘림 원천 차단)·경계선 보강·제목 고아 방지, 더보기에 버전 표시 // 인쇄 v7: 고정 페이지 상자로 넘김 통제(기기 무관) // 본대 버스 통합 칩(호차 요약↔상세, 호차 증가 대비), 칩 순서 정리 // 인쇄 v6: zoom 폐기(무시 기기 대응), 글자 px 직접 조절+재측정+검증 // 인쇄 꼬리 높이 반영(마지막 2줄 밀림 해결), 칩 스크롤 보존, 홈 숙소 현황 제거 // 차편 탭 2단 정리(요약↔차수, 차주 접힘 카드·바로가기, 뒤로가기=전체) // 인쇄 v4: 행 높이 실측 합산(두 줄 행 반영), 고아 페이지·조기 넘김 제거 // 인쇄 아래 여백 제거(A4 측정·장별 채움 v3) // 차편 날짜·시각·선탑자 차수별 독립(같은 차주도 차수별), 버스 미등록 차수 키 이관 // 탑승 확인 차수별 독립 저장 + 편집 저장 시 보존 // 인쇄: 글자·행간 분리 조절로 20~30명도 한 장 꽉 채움 // 본대 외 차편에 차수별 전체보기·사진·인쇄 // 인쇄 자동 크기(균등 분면·한 장 채움), 불참·환불은 차수 없이 저장, 전도 명단 차수 열 // '차수 해제=그 차수 불참' 원칙(표식·이력·도움말) // 차수 명단: 그 차수 교통편만·비고 제거 // 숙소 정원 소실 근본 수정(rev 분리 + 정원 보존 병합) // 홈 상단 2줄 재배치(등록·전도 / 구원·침례·접수현황·기도명단), 구원 명단 시트 // 사진 최대화질(긴 명단 여러 장 분할)·한 번에 공유, 인쇄 한 장 맞춤, 전도 사진 버튼, 이력 병합 보존 // 숙소 탭 신설(칩·정원·배정·미등록 인원), 차수 미정 지원, 숙소는 본 차수 전용, 사진 최대 화질
const CACHE_VERSION = 'retreat-sync-v11.9.1';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './template.xlsx',
];
const CDN_ASSETS = [
  'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css',
  'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  'https://www.gstatic.com/firebasejs/12.13.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/12.13.0/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore-compat.js',
];

// 페이지에서 'skipWaiting' 메시지를 받으면 대기 중인 새 SW를 즉시 활성화
//  → controllerchange가 발생하고, 페이지가 자동으로 최신 버전으로 새로고침됨
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_VERSION);
    // 핵심 자원은 무조건 캐시 — 한 개라도 실패하면 캐시 안 됨, 그래서 개별로 추가
    await Promise.all(CORE_ASSETS.map(async (url) => {
      try { await cache.add(url); } catch (e) { console.warn('Core skip:', url, e.message); }
    }));
    // index.html을 './' 키로도 동시에 저장 → 어떤 경로로 와도 매칭되도록
    try {
      const indexRes = await cache.match('./index.html');
      if (indexRes) {
        await cache.put('./', indexRes.clone());
        await cache.put('index.html', indexRes.clone());
      }
    } catch(e) { console.warn('alias cache skip', e); }
    // CDN은 옵셔널
    await Promise.all(CDN_ASSETS.map(async (url) => {
      try { await cache.add(url); } catch (e) { console.warn('CDN skip:', url, e.message); }
    }));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // navigationPreload — SW 시작 동안 네트워크 요청 미리 시작 (모바일 속도 ↑)
    if (self.registration.navigationPreload) {
      try { await self.registration.navigationPreload.enable(); } catch(e){}
    }
    // 오래된 캐시 정리
    const names = await caches.keys();
    await Promise.all(names.map(n => n !== CACHE_VERSION && caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Firebase 실시간/인증 트래픽은 SW가 절대 건드리지 않음 (그대로 네트워크로)
  if (/\.googleapis\.com$/.test(url.hostname)) return;
  const isHTML = req.mode === 'navigate' ||
    (req.headers.get('accept') || '').includes('text/html');

  // HTML/네비게이션 요청 — 캐시 우선, 네트워크는 백그라운드 갱신
  // 어떤 경로로 들어와도(./, ./index.html, /index.html 등) 동일한 index.html 응답 반환
  if (isHTML) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_VERSION);
      // 캐시에서 index.html 찾기 — 가능한 모든 키 시도 (상대/절대)
      const cacheKeys = ['./index.html', './', 'index.html', '/', new URL('./index.html', self.registration.scope).href];
      let cached = null;
      for (const key of cacheKeys) {
        cached = await cache.match(key);
        if (cached) break;
      }
      if (!cached) cached = await cache.match(req); // 마지막 수단

      // navigationPreload (있다면)
      const preload = event.preloadResponse ? event.preloadResponse.catch(() => null) : Promise.resolve(null);
      // 네트워크 시도 (백그라운드 갱신용)
      const network = fetch(req).then((res) => {
        if (res && res.ok) {
          // 새 응답을 모든 가능한 키로 캐시에 저장 → 다음 번엔 어떤 경로로 와도 hit
          const clone = res.clone();
          cache.put('./index.html', clone).catch(()=>{});
        }
        return res;
      }).catch(() => null);

      // 캐시가 있으면 즉시 반환 (네트워크는 백그라운드)
      if (cached) return cached;

      // 캐시 없음 → preload 또는 네트워크
      const fresh = (await preload) || (await network);
      if (fresh) return fresh;

      // 최후 fallback
      return new Response(
        '<!doctype html><html lang="ko"><meta charset="utf-8"><title>오프라인</title>' +
        '<body style="font-family:sans-serif;padding:20px;text-align:center"><h2>연결 실패</h2>' +
        '<p>네트워크에 연결되어 있는지 확인하시고, 한 번 더 시도해 주세요.</p>' +
        '<button onclick="location.reload()" style="padding:10px 20px;font-size:16px">다시 시도</button></body></html>',
        { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    })());
    return;
  }

  // 일반 자원 (JS/CSS/이미지/CDN) — Stale-While-Revalidate
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_VERSION);
    const cached = await cache.match(req);
    const fetchPromise = fetch(req).then((res) => {
      if (res && res.ok && (url.origin === location.origin
          || CDN_ASSETS.some((u) => req.url.startsWith(u.split('?')[0])))) {
        cache.put(req, res.clone()).catch(()=>{});
      }
      return res;
    }).catch(() => cached);
    return cached || fetchPromise;
  })());
});

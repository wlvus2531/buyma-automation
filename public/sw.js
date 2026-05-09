/**
 * 바이마 사장님 PWA Service Worker
 *
 * 기능:
 *  1. 푸시 알림 수신 (Web Push)
 *  2. 알림 클릭 → /owner?id=... 로 이동
 *  3. action 버튼(✅/❌) 처리 → 즉시 승인/거부 API 호출
 *  4. 오프라인 폴백 (간단한 캐싱)
 */

const CACHE_VERSION = 'buyma-owner-v1';
const STATIC_CACHE = [
  '/owner',
  '/manifest.json',
];

// 설치 — 즉시 활성화
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(STATIC_CACHE).catch(() => {}))
  );
  self.skipWaiting();
});

// 활성화 — 즉시 클라이언트 제어
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
      ),
      self.clients.claim(),
    ])
  );
});

// 푸시 수신
self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: '바이마 운영', body: event.data.text() };
  }

  const {
    title = '바이마 운영',
    body = '확인이 필요합니다',
    icon = '/icon-192.png',
    badge = '/icon-192.png',
    data = {},
    actions = [],
    tag,
    requireInteraction = false,
  } = payload;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge,
      data,
      actions,
      tag: tag || data.approval_id || 'buyma',
      requireInteraction,
      vibrate: [100, 50, 100],
    })
  );
});

// 알림 클릭
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const action = event.action;
  const targetUrl = data.url || `/owner${data.approval_id ? `?id=${data.approval_id}` : ''}`;

  // action 버튼: 승인/거부 → fetch 즉시 처리, 알림창은 닫음
  if (action === 'approve' || action === 'reject') {
    event.waitUntil(
      fetch('/api/approvals/decide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approval_id: data.approval_id,
          action,
        }),
      }).catch(() => {
        // 실패 시 클라이언트 열어서 처리
        return self.clients.openWindow(targetUrl);
      })
    );
    return;
  }

  // 일반 클릭: 클라이언트 열기 또는 포커스
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('/owner') && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// 푸시 구독 만료 시 재구독
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.registration.pushManager
      .subscribe({
        userVisibleOnly: true,
        applicationServerKey: event.oldSubscription?.options.applicationServerKey,
      })
      .then((subscription) =>
        fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription }),
        })
      )
  );
});

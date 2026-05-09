/**
 * background.js — BUYMA 모니터링 서비스 워커 (MV3)
 * - content.js로부터 캡처 데이터 수신 → API 전송
 * - 뱃지 카운트 업데이트
 * - 경쟁자 알림 Chrome Notification 발송
 */

const DEFAULT_API_BASE = 'https://buyma-automation-vi3y.vercel.app';

// ──────────────────────────────────────────────
// 설정 로드
// ──────────────────────────────────────────────
async function getConfig() {
  return new Promise(resolve => {
    chrome.storage.local.get(['apiUrl'], result => {
      resolve({ apiUrl: result.apiUrl || DEFAULT_API_BASE });
    });
  });
}

// ──────────────────────────────────────────────
// API 전송
// ──────────────────────────────────────────────
async function reportToAPI(items) {
  const { apiUrl } = await getConfig();
  try {
    const res = await fetch(`${apiUrl}/api/monitor/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    console.error('[Monitor] API 전송 실패', e);
    return null;
  }
}

// ──────────────────────────────────────────────
// 오늘 통계 조회
// ──────────────────────────────────────────────
async function fetchStats() {
  const { apiUrl } = await getConfig();
  try {
    const res = await fetch(`${apiUrl}/api/monitor/list?summary=true`);
    if (!res.ok) return { total: 0, alerts: 0 };
    return await res.json();
  } catch {
    return { total: 0, alerts: 0 };
  }
}

// ──────────────────────────────────────────────
// 뱃지 업데이트
// ──────────────────────────────────────────────
function updateBadge(count, hasAlert) {
  if (hasAlert) {
    chrome.action.setBadgeText({ text: '!' });
    chrome.action.setBadgeBackgroundColor({ color: '#dc2626' });
  } else if (count > 0) {
    chrome.action.setBadgeText({ text: String(count > 99 ? '99+' : count) });
    chrome.action.setBadgeBackgroundColor({ color: '#1c1917' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

// ──────────────────────────────────────────────
// Chrome 알림 발송
// ──────────────────────────────────────────────
function notify(title, message, id) {
  chrome.notifications.create(id || Date.now().toString(), {
    type: 'basic',
    title,
    message,
    iconUrl: 'icons/icon48.png',
    priority: 2,
  });
}

// ──────────────────────────────────────────────
// 메시지 핸들러
// ──────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  // content.js → 캡처 데이터 수신
  if (msg.type === 'BUYMA_ITEMS_CAPTURED') {
    (async () => {
      const validItems = msg.items.filter(i => i && (i.buyma_item_id || i.buyma_url));
      if (validItems.length === 0) {
        sendResponse({ ok: false, reason: 'no_valid_items' });
        return;
      }

      const result = await reportToAPI(validItems);
      const stats  = await fetchStats();

      updateBadge(stats.total, stats.alerts > 0);

      // 새 알림이 생겼으면 Chrome 알림 발송
      if (result?.new_alerts?.length > 0) {
        for (const alert of result.new_alerts) {
          notify(
            '⚠️ BUYMA 경쟁자 알림',
            alert.message || `${alert.item_name} 가격 변동`,
            alert.id
          );
        }
      }

      sendResponse({ ok: true, saved: result?.saved ?? 0 });
    })();
    return true; // 비동기 응답 유지
  }

  // 팝업 → 통계 요청
  if (msg.type === 'GET_STATS') {
    fetchStats().then(sendResponse);
    return true;
  }

  // 팝업 → 설정 저장
  if (msg.type === 'SAVE_CONFIG') {
    chrome.storage.local.set(msg.config, () => sendResponse({ ok: true }));
    return true;
  }
});

// ──────────────────────────────────────────────
// 설치 시 초기화
// ──────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ apiUrl: DEFAULT_API_BASE });
  updateBadge(0, false);
});

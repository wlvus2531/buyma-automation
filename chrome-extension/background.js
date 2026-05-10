/**
 * background.js — BUYMA 운영 자동화 서비스 워커 (MV3)
 *
 * V1 (모니터링): content.js 수집 데이터 → API 전송, 경쟁자 알림
 * V2 (자동 입력): autofill.js의 상품 목록 요청, 등록 완료 처리
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
// API 요청 공통
// ──────────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const { apiUrl } = await getConfig();
  try {
    const res = await fetch(`${apiUrl}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    console.error(`[Monitor] API 실패 ${path}`, e);
    return null;
  }
}

// ──────────────────────────────────────────────
// V1: 경쟁자 데이터 전송
// ──────────────────────────────────────────────
async function reportCompetitors(items) {
  return apiFetch('/api/monitor/report', {
    method: 'POST',
    body: JSON.stringify({ items }),
  });
}

// ──────────────────────────────────────────────
// V1: 통계 조회 (팝업 + /today 연동)
// ──────────────────────────────────────────────
async function fetchMonitorStats() {
  const data = await apiFetch('/api/monitor/list?summary=true');
  return data || { total: 0, alerts: 0, sellers: 0, recent_alerts: [] };
}

// ──────────────────────────────────────────────
// V2: approved 상품 목록 조회
// ──────────────────────────────────────────────
async function fetchAutofillProducts() {
  const data = await apiFetch('/api/listing/autofill');
  return data?.products || [];
}

// ──────────────────────────────────────────────
// V2: 등록 완료 처리
// ──────────────────────────────────────────────
async function markListed(id, buymaListingUrl) {
  return apiFetch('/api/listing/autofill', {
    method: 'POST',
    body: JSON.stringify({ id, buyma_listing_url: buymaListingUrl }),
  });
}

// ──────────────────────────────────────────────
// 뱃지 업데이트
// ──────────────────────────────────────────────
async function refreshBadge() {
  const stats = await fetchMonitorStats();
  if (stats.alerts > 0) {
    chrome.action.setBadgeText({ text: '!' });
    chrome.action.setBadgeBackgroundColor({ color: '#dc2626' });
  } else if (stats.total > 0) {
    chrome.action.setBadgeText({ text: String(Math.min(stats.total, 99)) });
    chrome.action.setBadgeBackgroundColor({ color: '#1c1917' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

// ──────────────────────────────────────────────
// Chrome 알림
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
  console.log('[BG] 메시지 수신:', msg.type);

  // ── V1: 경쟁자 데이터 수신
  if (msg.type === 'BUYMA_ITEMS_CAPTURED') {
    (async () => {
      const validItems = (msg.items || []).filter(i => i?.buyma_item_id || i?.buyma_url);
      if (!validItems.length) { sendResponse({ ok: false }); return; }

      const result = await reportCompetitors(validItems);
      await refreshBadge();

      if (result?.new_alerts?.length > 0) {
        for (const a of result.new_alerts) {
          notify('⚠️ BUYMA 경쟁자 알림', a.message || a.item_name, a.id);
        }
      }
      sendResponse({ ok: true, saved: result?.saved ?? 0 });
    })();
    return true;
  }

  // ── V1: 팝업 통계 요청
  if (msg.type === 'GET_STATS') {
    fetchMonitorStats().then(sendResponse);
    return true;
  }

  // ── V2: 자동 입력 상품 목록 요청
  if (msg.type === 'GET_AUTOFILL_PRODUCTS') {
    fetchAutofillProducts().then(sendResponse);
    return true;
  }

  // ── V2: 등록 완료 처리
  if (msg.type === 'MARK_LISTED') {
    (async () => {
      const result = await markListed(msg.id, msg.buyma_listing_url);
      sendResponse({ ok: !!result?.ok });
    })();
    return true;
  }

  // ── 설정 저장
  if (msg.type === 'SAVE_CONFIG') {
    chrome.storage.local.set(msg.config, () => sendResponse({ ok: true }));
    return true;
  }
});

// ──────────────────────────────────────────────
// 설치 시 초기화
// ──────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(({ reason }) => {
  chrome.storage.local.set({ apiUrl: DEFAULT_API_BASE });
  chrome.action.setBadgeText({ text: '' });
  if (reason === 'install') {
    console.log('[BUYMA 자동화] 확장 설치 완료');
  }
});

// 알람: 5분마다 뱃지 새로고침
chrome.alarms.create('badge-refresh', { periodInMinutes: 5 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'badge-refresh') refreshBadge();
});

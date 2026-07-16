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
  // ── V1: 경쟁자 데이터 수신 (+ V4: 리서치 탭이면 리서치 파이프라인으로)
  if (msg.type === 'BUYMA_ITEMS_CAPTURED') {
    (async () => {
      const validItems = (msg.items || []).filter(i => i?.buyma_item_id || i?.buyma_url);
      if (!validItems.length) { sendResponse({ ok: false }); return; }

      // 리서치 수집 세션의 탭이면 → 리서치 리포트로
      const handled = await handleResearchCapture({ items: validItems }, _sender?.tab?.id);
      if (handled) { sendResponse({ ok: true, research: true }); return; }

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

  // ── V4: 리서치 수집 시작
  if (msg.type === 'RESEARCH_START') {
    startResearch().then(sendResponse);
    return true;
  }

  // ── V4: 리서치 진행 상태
  if (msg.type === 'RESEARCH_STATUS') {
    sendResponse({
      running: research.running,
      total: research.missions.length,
      done: research.results.length,
      current: research.running && research.currentIdx >= 0 && research.currentIdx < research.missions.length
        ? research.missions[research.currentIdx].label : null,
      results: research.results,
    });
    return true;
  }

  // ── V4: 리서치 중지
  if (msg.type === 'RESEARCH_STOP') {
    research.running = false;
    if (research.currentTabId) { try { chrome.tabs.remove(research.currentTabId); } catch {} }
    research.currentTabId = null;
    sendResponse({ ok: true });
    return true;
  }
});

// ══════════════════════════════════════════════
// V4 P1: 리서치 수집기 — 미션 순회 수집
// ══════════════════════════════════════════════

const research = {
  running: false,
  missions: [],
  currentIdx: -1,
  currentTabId: null,
  collectorKey: '',
  results: [], // { label, saved, discarded }
};

async function getCollectorKey() {
  return new Promise(resolve => {
    chrome.storage.local.get(['collectorKey'], r => resolve(r.collectorKey || ''));
  });
}

async function collectorFetch(path, options = {}) {
  const { apiUrl } = await getConfig();
  const key = research.collectorKey || (await getCollectorKey());
  try {
    const res = await fetch(`${apiUrl}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', 'x-collector-key': key, ...(options.headers || {}) },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { __error: data.error || `HTTP ${res.status}` };
    return data;
  } catch (e) {
    return { __error: String(e) };
  }
}

function researchDelay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function startResearch() {
  if (research.running) return { ok: false, error: '이미 수집 중' };
  research.collectorKey = await getCollectorKey();
  if (!research.collectorKey) return { ok: false, error: '수집기 키 미설정 (설정 탭에서 입력)' };

  // 오늘 미션 가져오기 (없으면 생성 시도)
  let data = await collectorFetch('/api/research/missions');
  if (data.__error) return { ok: false, error: data.__error };
  if (!data.missions?.length) {
    const gen = await collectorFetch('/api/research/missions', {
      method: 'POST', body: JSON.stringify({ action: 'generate' }),
    });
    if (gen.__error) return { ok: false, error: gen.__error };
    data = await collectorFetch('/api/research/missions');
  }

  const pending = (data.missions || []).filter(m => m.status === 'pending' || m.status === 'failed');
  if (!pending.length) return { ok: false, error: '수집할 미션 없음 (전부 완료됨)' };

  research.running = true;
  research.missions = pending;
  research.currentIdx = -1;
  research.results = [];
  runNextMission();
  return { ok: true, total: pending.length };
}

async function runNextMission() {
  research.currentIdx++;
  if (!research.running || research.currentIdx >= research.missions.length) {
    research.running = false;
    const totalSaved = research.results.reduce((s, r) => s + (r.saved || 0), 0);
    notify('🔍 리서치 수집 완료', `미션 ${research.results.length}개 · 후보 ${totalSaved}개 수집`);
    return;
  }
  const mission = research.missions[research.currentIdx];
  await collectorFetch('/api/research/missions', {
    method: 'POST', body: JSON.stringify({ action: 'update', id: mission.id, status: 'running' }),
  });

  chrome.tabs.create({ url: mission.entry_url, active: false }, tab => {
    research.currentTabId = tab.id;
    // 30초 안에 수집 메시지가 안 오면 실패 처리 후 다음
    setTimeout(async () => {
      if (research.running && research.currentTabId === tab.id) {
        research.currentTabId = null;
        try { chrome.tabs.remove(tab.id); } catch {}
        await collectorFetch('/api/research/missions', {
          method: 'POST', body: JSON.stringify({ action: 'update', id: mission.id, status: 'failed' }),
        });
        research.results.push({ label: mission.label, saved: 0, error: 'timeout' });
        await researchDelay(4000);
        runNextMission();
      }
    }, 30000);
  });
}

async function handleResearchCapture(msg, tabId) {
  if (!research.running || tabId !== research.currentTabId) return false;
  const mission = research.missions[research.currentIdx];
  research.currentTabId = null;

  const report = await collectorFetch('/api/research/report', {
    method: 'POST',
    body: JSON.stringify({
      mission_id: mission.id,
      method: mission.method,
      items: msg.items,
    }),
  });

  const failed = !!report.__error;
  await collectorFetch('/api/research/missions', {
    method: 'POST',
    body: JSON.stringify({
      action: 'update', id: mission.id,
      status: failed ? 'failed' : 'done',
    }),
  });
  research.results.push({ label: mission.label, saved: report.saved || 0, discarded: report.discarded || 0, error: report.__error });

  try { chrome.tabs.remove(tabId); } catch {}
  await researchDelay(4000 + Math.random() * 2000); // 4~6초 간격 (rate limit 배려)
  runNextMission();
  return true;
}

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

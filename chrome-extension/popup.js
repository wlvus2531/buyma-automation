/**
 * popup.js — BUYMA 모니터링 팝업 로직
 */

const DEFAULT_API = 'https://buyma-automation-vi3y.vercel.app';

// ──────────────────────────────────────────────
// DOM refs
// ──────────────────────────────────────────────
const statTotal   = document.getElementById('stat-total');
const statSellers = document.getElementById('stat-sellers');
const statAlerts  = document.getElementById('stat-alerts');
const alertList   = document.getElementById('alert-list');
const statusDot   = document.getElementById('status-dot');
const statusText  = document.getElementById('status-text');
const dashBtn     = document.getElementById('dashboard-btn');
const apiInput    = document.getElementById('api-url-input');
const saveMsg     = document.getElementById('save-msg');

// ──────────────────────────────────────────────
// 초기화
// ──────────────────────────────────────────────
(async function init() {
  // 저장된 API URL 로드
  const result = await chrome.storage.local.get(['apiUrl']);
  const apiUrl = result.apiUrl || DEFAULT_API;
  apiInput.value = apiUrl;
  dashBtn.href = `${apiUrl}/monitor`;

  // 통계 로드
  try {
    chrome.runtime.sendMessage({ type: 'GET_STATS' }, stats => {
      if (chrome.runtime.lastError || !stats) {
        setStatus(false, '서버 연결 실패');
        return;
      }
      setStatus(true, `${apiUrl.replace('https://', '')} 연결됨`);
      renderStats(stats);
      renderAlerts(stats.recent_alerts || []);
    });
  } catch {
    setStatus(false, '확장 오류');
  }

  // API URL 변경 → debounce 저장
  let saveTimer;
  apiInput.addEventListener('input', () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const url = apiInput.value.trim().replace(/\/$/, '');
      if (!url) return;
      chrome.runtime.sendMessage({ type: 'SAVE_CONFIG', config: { apiUrl: url } }, () => {
        dashBtn.href = `${url}/monitor`;
        saveMsg.style.display = 'block';
        setTimeout(() => (saveMsg.style.display = 'none'), 2000);
      });
    }, 800);
  });
})();

// ──────────────────────────────────────────────
// 렌더링
// ──────────────────────────────────────────────
function renderStats(stats) {
  statTotal.textContent   = stats.total   ?? 0;
  statSellers.textContent = stats.sellers ?? 0;
  statAlerts.textContent  = stats.alerts  ?? 0;
}

function renderAlerts(alerts) {
  if (!alerts.length) {
    alertList.innerHTML = '<div class="empty-state">알림 없음</div>';
    return;
  }
  alertList.innerHTML = alerts.slice(0, 4).map(a => `
    <div class="alert-item">
      <div class="name">${esc(a.item_name || '알 수 없음')}</div>
      <div class="detail">${esc(a.alert_reason || '')} · ${a.price_jpy ? '¥' + a.price_jpy.toLocaleString() : ''}</div>
    </div>
  `).join('');
}

function setStatus(ok, text) {
  statusDot.className = 'dot ' + (ok ? 'ok' : 'err');
  statusText.textContent = text;
}

function esc(str) {
  return String(str).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

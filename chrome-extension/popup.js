/**
 * popup.js — BUYMA 운영 자동화 팝업 로직 (V2)
 */

const DEFAULT_API = 'https://buyma-automation-vi3y.vercel.app';

// ── DOM refs
const apiInput   = document.getElementById('api-url-input');
const saveMsg    = document.getElementById('save-msg');
const dashBtn    = document.getElementById('dashboard-btn');
const registerBtn = document.getElementById('register-btn');

// ── 탭 전환
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`panel-${btn.dataset.tab}`)?.classList.add('active');
  });
});

// ── 초기화
(async function init() {
  const result = await chrome.storage.local.get(['apiUrl']);
  const apiUrl = result.apiUrl || DEFAULT_API;
  apiInput.value = apiUrl;
  dashBtn.href    = `${apiUrl}/monitor`;
  registerBtn.href = `${apiUrl}/register`;

  // 모니터링 통계
  chrome.runtime.sendMessage({ type: 'GET_STATS' }, stats => {
    const ok = !chrome.runtime.lastError && stats;
    setStatus(ok, ok ? `${apiUrl.replace('https://', '')} 연결됨` : '서버 연결 실패');
    if (ok) renderMonitorStats(stats);
  });

  // 자동 입력 상품 목록
  chrome.runtime.sendMessage({ type: 'GET_AUTOFILL_PRODUCTS' }, products => {
    renderAutofillList(products || []);
  });

  // API URL 변경
  let saveTimer;
  apiInput.addEventListener('input', () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const url = apiInput.value.trim().replace(/\/$/, '');
      if (!url) return;
      chrome.runtime.sendMessage({ type: 'SAVE_CONFIG', config: { apiUrl: url } }, () => {
        dashBtn.href = `${url}/monitor`;
        registerBtn.href = `${url}/register`;
        saveMsg.style.display = 'block';
        setTimeout(() => (saveMsg.style.display = 'none'), 2000);
      });
    }, 800);
  });
})();

// ── 모니터링 탭 렌더
function renderMonitorStats(stats) {
  document.getElementById('stat-total').textContent   = stats.total   ?? 0;
  document.getElementById('stat-sellers').textContent = stats.sellers ?? 0;
  document.getElementById('stat-alerts').textContent  = stats.alerts  ?? 0;

  const alertList = document.getElementById('alert-list');
  const alerts = stats.recent_alerts || [];
  if (!alerts.length) {
    alertList.innerHTML = '<div class="empty-state">알림 없음</div>';
    return;
  }
  alertList.innerHTML = alerts.slice(0, 4).map(a => `
    <div class="alert-item">
      <div class="aname">${esc(a.item_name || '알 수 없음')}</div>
      <div class="adetail">${esc(a.alert_reason || '')}${a.price_jpy ? ' · ¥' + Number(a.price_jpy).toLocaleString() : ''}</div>
    </div>
  `).join('');
}

// ── 자동 입력 탭 렌더
function renderAutofillList(products) {
  const list  = document.getElementById('autofill-list');
  const count = document.getElementById('af-count');
  if (count) count.textContent = `(${products.length}건)`;

  if (!products.length) {
    list.innerHTML = '<div class="empty-state">등록 예정 상품이 없습니다<br/>등록 워크플로우에서 승인해주세요</div>';
    return;
  }

  list.innerHTML = products.slice(0, 8).map(p => `
    <div class="af-item">
      <div class="af-name">${esc(p.name_kr || '')}</div>
      <div class="af-jp">${esc(p.title_jp || p.name_jp || '—')}</div>
      <div class="af-meta">
        <span class="af-price">${p.list_price_jpy ? '¥' + Number(p.list_price_jpy).toLocaleString() : '—'}</span>
        ${p.buyma_category ? `<span>${esc(p.buyma_category)}</span>` : ''}
        ${p.margin_pct != null ? `<span>${p.margin_pct}%</span>` : ''}
      </div>
    </div>
  `).join('');
}

function setStatus(ok, text) {
  const dot  = document.getElementById('status-dot');
  const span = document.getElementById('status-text');
  if (dot)  dot.className  = 'dot ' + (ok ? 'ok' : 'err');
  if (span) span.textContent = text;
}

function esc(str) {
  return String(str || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

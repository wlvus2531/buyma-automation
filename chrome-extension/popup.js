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
  const result = await chrome.storage.local.get(['apiUrl', 'collectorKey']);
  const apiUrl = result.apiUrl || DEFAULT_API;
  apiInput.value = apiUrl;

  // 수집기 키
  const keyInput = document.getElementById('collector-key-input');
  const keySaveMsg = document.getElementById('key-save-msg');
  if (keyInput) {
    keyInput.value = result.collectorKey || '';
    let keyTimer;
    keyInput.addEventListener('input', () => {
      clearTimeout(keyTimer);
      keyTimer = setTimeout(() => {
        chrome.runtime.sendMessage({ type: 'SAVE_CONFIG', config: { collectorKey: keyInput.value.trim() } }, () => {
          keySaveMsg.style.display = 'block';
          setTimeout(() => (keySaveMsg.style.display = 'none'), 2000);
        });
      }, 800);
    });
  }

  // 리서치 수집
  initResearchTab();
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

// ── 리서치 탭 (V4 P1)
function initResearchTab() {
  const startBtn = document.getElementById('research-start-btn');
  const stopBtn = document.getElementById('research-stop-btn');
  const statusEl = document.getElementById('research-status');
  const resultsEl = document.getElementById('research-results');
  if (!startBtn) return;

  let pollTimer = null;

  function renderStatus(s) {
    if (!s) return;
    if (s.running) {
      startBtn.style.display = 'none';
      stopBtn.style.display = 'block';
      statusEl.textContent = `수집 중 ${s.done}/${s.total} — ${s.current || '...'}`;
    } else {
      startBtn.style.display = 'block';
      stopBtn.style.display = 'none';
      statusEl.textContent = s.results?.length
        ? `완료: 미션 ${s.results.length}개`
        : '대기 중';
      if (pollTimer && !s.running) { clearInterval(pollTimer); pollTimer = null; }
    }
    if (s.results?.length) {
      resultsEl.innerHTML = s.results.map(r => `
        <div class="alert-item" style="border-color:${r.error ? '#fca5a5' : '#bbf7d0'};">
          <div class="aname" style="color:${r.error ? '#991b1b' : '#166534'};">${esc(r.label)}</div>
          <div class="adetail">${r.error ? esc(r.error) : `수집 ${r.saved}개${r.discarded ? ` · 필터 제외 ${r.discarded}` : ''}`}</div>
        </div>
      `).join('');
    }
  }

  function startPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(() => {
      chrome.runtime.sendMessage({ type: 'RESEARCH_STATUS' }, renderStatus);
    }, 1500);
  }

  startBtn.addEventListener('click', () => {
    statusEl.textContent = '시작 중...';
    chrome.runtime.sendMessage({ type: 'RESEARCH_START' }, res => {
      if (!res?.ok) {
        statusEl.textContent = `✕ ${res?.error || '시작 실패'}`;
        return;
      }
      startPolling();
    });
  });

  stopBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'RESEARCH_STOP' }, () => {
      statusEl.textContent = '중지됨';
      startBtn.style.display = 'block';
      stopBtn.style.display = 'none';
    });
  });

  // 열 때 현재 상태 반영
  chrome.runtime.sendMessage({ type: 'RESEARCH_STATUS' }, s => {
    renderStatus(s);
    if (s?.running) startPolling();
  });
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

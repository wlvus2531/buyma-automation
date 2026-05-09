/**
 * autofill.js — BUYMA 등록 폼 자동 입력 패널 (Chrome 확장 V2)
 * 실행 환경: www.buyma.com/* (document_idle)
 *
 * 동작:
 *  1. 페이지에 텍스트 입력 폼이 감지되면 우측 패널 삽입
 *  2. background.js를 통해 approved 상품 목록 로드
 *  3. "자동 입력" 클릭 → BUYMA 폼 필드에 JP 데이터 채움
 *  4. "등록 완료" 클릭 → API 호출로 listing_status = 'listed'
 */
(function () {
  'use strict';

  if (window.__buymaAutofillLoaded) return;
  window.__buymaAutofillLoaded = true;

  // ────────────────────────────────────────────
  // BUYMA 폼 필드 셀렉터 (우선순위 순)
  // ────────────────────────────────────────────
  const FIELD_SELECTORS = {
    title: [
      'input[name*="item_name"]',   'input[id*="item_name"]',
      'input[name*="title"]',       'input[id*="title"]',
      'input[name*="name"]',        '#item_name', '#title',
      'input[placeholder*="商品名"]', 'input[placeholder*="タイトル"]',
    ],
    description: [
      'textarea[name*="description"]',   'textarea[id*="description"]',
      'textarea[name*="detail"]',        'textarea[id*="detail"]',
      'textarea[name*="comment"]',       '#description', '#item_description',
      'textarea[placeholder*="説明"]',   'textarea[placeholder*="詳細"]',
    ],
    price: [
      'input[name*="price"]',   'input[id*="price"]',
      'input[name*="値段"]',    '#price', '#item_price',
      'input[type="number"][name*="price"]',
    ],
    category: [
      'select[name*="category"]', 'select[id*="category"]',
      'select[name*="categ"]',    '#category_id', '#category',
    ],
    brand: [
      'input[name*="brand"]', 'input[id*="brand"]',
      'select[name*="brand"]', '#brand', '#brand_name',
    ],
    tags: [
      'input[name*="tag"]', 'input[id*="tag"]',
      'input[name*="keyword"]', '#tags', '#item_tags',
    ],
  };

  // ────────────────────────────────────────────
  // 폼 감지 — 입력 필드가 3개 이상이면 등록 폼으로 간주
  // ────────────────────────────────────────────
  function hasListingForm() {
    const inputs = document.querySelectorAll('input[type="text"], input[type="number"], textarea');
    return inputs.length >= 3;
  }

  if (!hasListingForm()) {
    // 폼 없는 페이지는 패널 삽입 안 함
    return;
  }

  // ────────────────────────────────────────────
  // 유틸
  // ────────────────────────────────────────────
  function findField(sels) {
    for (const sel of sels) {
      try {
        const el = document.querySelector(sel);
        if (el) return el;
      } catch {}
    }
    return null;
  }

  function setFieldValue(el, value) {
    if (!el || !value) return false;
    try {
      el.focus();
      const nativeInputValue = Object.getOwnPropertyDescriptor(
        el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
        'value'
      );
      if (nativeInputValue) {
        nativeInputValue.set.call(el, value);
      } else {
        el.value = value;
      }
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.classList.add('baf-field-highlight');
      setTimeout(() => el.classList.remove('baf-field-highlight'), 2000);
      return true;
    } catch { return false; }
  }

  function setSelectValue(el, value) {
    if (!el || !value) return false;
    try {
      // 옵션 텍스트 일치 검색
      const options = Array.from(el.options || []);
      const match = options.find(o =>
        o.text.includes(value) || value.includes(o.text) ||
        o.value === value
      );
      if (match) {
        el.value = match.value;
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
    } catch {}
    return false;
  }

  function showToast(msg, duration = 2500) {
    const existing = document.getElementById('baf-toast-msg');
    if (existing) existing.remove();
    const el = document.createElement('div');
    el.id = 'baf-toast-msg';
    el.className = 'baf-toast';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), duration);
  }

  // ────────────────────────────────────────────
  // 자동 입력 실행
  // ────────────────────────────────────────────
  function autofillProduct(product) {
    let filled = 0;

    // 제목
    const titleEl = findField(FIELD_SELECTORS.title);
    if (setFieldValue(titleEl, product.title_jp || product.name_jp)) filled++;

    // 설명
    const descEl = findField(FIELD_SELECTORS.description);
    if (setFieldValue(descEl, product.description_jp)) filled++;

    // 가격
    const priceEl = findField(FIELD_SELECTORS.price);
    if (priceEl && product.list_price_jpy) {
      if (setFieldValue(priceEl, String(product.list_price_jpy))) filled++;
    }

    // 카테고리 (select or text)
    if (product.buyma_category) {
      const catEl = findField(FIELD_SELECTORS.category);
      if (catEl) {
        const ok = catEl.tagName === 'SELECT'
          ? setSelectValue(catEl, product.buyma_category)
          : setFieldValue(catEl, product.buyma_category);
        if (ok) filled++;
      }
    }

    // 브랜드
    if (product.brand) {
      const brandEl = findField(FIELD_SELECTORS.brand);
      if (brandEl) {
        const ok = brandEl.tagName === 'SELECT'
          ? setSelectValue(brandEl, product.brand)
          : setFieldValue(brandEl, product.brand);
        if (ok) filled++;
      }
    }

    // 태그 (첫 번째 태그만)
    if (product.listing_tags?.length > 0) {
      const tagEl = findField(FIELD_SELECTORS.tags);
      if (tagEl) {
        if (setFieldValue(tagEl, product.listing_tags.join(' '))) filled++;
      }
    }

    return filled;
  }

  // ────────────────────────────────────────────
  // 패널 렌더링
  // ────────────────────────────────────────────
  let allProducts = [];
  let collapsed = false;
  let filledIds = new Set();

  function createPanel() {
    const panel = document.createElement('div');
    panel.id = 'buyma-autofill-panel';
    panel.innerHTML = `
      <div class="baf-header" id="baf-header">
        <div class="baf-header-left">
          <div class="baf-logo">B</div>
          <span class="baf-title">자동 입력</span>
          <span class="baf-count" id="baf-count">로딩 중...</span>
        </div>
        <span class="baf-toggle" id="baf-toggle">◀</span>
      </div>
      <div class="baf-body">
        <div class="baf-search">
          <input type="text" id="baf-search-input" placeholder="상품명 검색..." />
        </div>
        <div class="baf-list" id="baf-list">
          <div class="baf-empty">
            <div class="baf-empty-icon">⏳</div>
            등록 예정 상품을 불러오는 중...
          </div>
        </div>
      </div>
      <div class="baf-footer">바이마 운영 자동화 v3.1 · Week 7</div>
    `;
    document.body.appendChild(panel);

    // 토글
    document.getElementById('baf-header').addEventListener('click', () => {
      collapsed = !collapsed;
      panel.classList.toggle('collapsed', collapsed);
      document.getElementById('baf-toggle').textContent = collapsed ? '▶' : '◀';
    });

    // 검색 필터
    document.getElementById('baf-search-input').addEventListener('input', (e) => {
      renderList(e.target.value.trim().toLowerCase());
    });

    return panel;
  }

  function renderList(filter = '') {
    const list = document.getElementById('baf-list');
    if (!list) return;

    const filtered = filter
      ? allProducts.filter(p =>
          (p.name_kr || '').toLowerCase().includes(filter) ||
          (p.title_jp || '').toLowerCase().includes(filter) ||
          (p.brand || '').toLowerCase().includes(filter)
        )
      : allProducts;

    if (filtered.length === 0) {
      list.innerHTML = `
        <div class="baf-empty">
          <div class="baf-empty-icon">📭</div>
          ${filter ? '검색 결과 없음' : '등록 예정 상품이 없습니다<br/>바이마 운영 앱에서 승인해주세요'}
        </div>
      `;
      return;
    }

    list.innerHTML = filtered.map(p => {
      const isFilled = filledIds.has(p.id);
      return `
        <div class="baf-item ${isFilled ? 'filled' : ''}" id="baf-item-${p.id}">
          <div class="baf-item-name">${esc(p.name_kr || '')}</div>
          <div class="baf-item-jp">${esc(p.title_jp || p.name_jp || '—')}</div>
          <div class="baf-item-meta">
            <span class="baf-price">${p.list_price_jpy ? '¥' + p.list_price_jpy.toLocaleString() : '—'}</span>
            ${p.buyma_category ? `<span class="baf-category">${esc(p.buyma_category)}</span>` : ''}
            ${p.margin_pct != null ? `<span>${p.margin_pct}%</span>` : ''}
          </div>
          <div class="baf-actions">
            <button class="baf-btn baf-btn-fill ${isFilled ? 'success' : ''}" data-id="${p.id}" data-action="fill">
              ${isFilled ? '✓ 입력됨' : '자동 입력'}
            </button>
            ${isFilled ? `
              <button class="baf-btn baf-btn-done" data-id="${p.id}" data-action="done">
                등록 완료 ✓
              </button>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');

    // 이벤트 위임
    list.onclick = (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      const product = allProducts.find(p => p.id === id);
      if (!product) return;

      if (action === 'fill') {
        const item = document.getElementById(`baf-item-${id}`);
        if (item) item.classList.add('filling');
        const count = autofillProduct(product);
        if (item) item.classList.remove('filling');
        filledIds.add(id);
        renderList(document.getElementById('baf-search-input')?.value.trim().toLowerCase() || '');
        showToast(count > 0
          ? `✓ ${product.name_kr} — ${count}개 필드 입력 완료`
          : `⚠️ 폼 필드를 찾지 못했습니다. 수동으로 입력해주세요`
        );
      }

      if (action === 'done') {
        markListed(product);
      }
    };
  }

  async function markListed(product) {
    const currentUrl = window.location.href;
    chrome.runtime.sendMessage({
      type: 'MARK_LISTED',
      id: product.id,
      buyma_listing_url: currentUrl,
    }, (result) => {
      if (result?.ok) {
        showToast(`✅ "${product.name_kr}" 등록 완료 처리됨`);
        // 목록에서 제거
        allProducts = allProducts.filter(p => p.id !== product.id);
        filledIds.delete(product.id);
        renderList();
        document.getElementById('baf-count').textContent = `${allProducts.length}건`;
      } else {
        showToast('❌ 등록 완료 처리 실패 — 앱에서 직접 처리해주세요');
      }
    });
  }

  function esc(str) {
    return String(str || '').replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  // ────────────────────────────────────────────
  // 초기화
  // ────────────────────────────────────────────
  createPanel();

  chrome.runtime.sendMessage({ type: 'GET_AUTOFILL_PRODUCTS' }, (products) => {
    allProducts = products || [];
    const countEl = document.getElementById('baf-count');
    if (countEl) countEl.textContent = `${allProducts.length}건`;
    renderList();
  });
})();

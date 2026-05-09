/**
 * content.js — BUYMA 페이지 데이터 수집기
 * 실행 환경: www.buyma.com/* (document_idle)
 * 수집 후 background.js로 메시지 전송
 */
(function () {
  'use strict';

  if (window.__buymaMonitorLoaded) return;
  window.__buymaMonitorLoaded = true;

  const url = location.href;
  const isItemPage   = /\/item\/[^/?#]+/.test(url);
  const isSearchPage = url.includes('/buy/') || url.includes('/search/');
  const isBrandPage  = /\/brand\/\d+/.test(url);

  if (!isItemPage && !isSearchPage && !isBrandPage) return;

  const pageType = isItemPage ? 'item' : isSearchPage ? 'search' : 'brand';

  // ──────────────────────────────────────────────
  // 헬퍼
  // ──────────────────────────────────────────────
  function parsePrice(text) {
    if (!text) return null;
    const n = parseInt(String(text).replace(/[^0-9]/g, ''), 10);
    return isNaN(n) || n === 0 ? null : n;
  }

  function textOf(el) {
    return el ? el.textContent.trim() : null;
  }

  function jsonLd() {
    try {
      const el = document.querySelector('script[type="application/ld+json"]');
      return el ? JSON.parse(el.textContent) : null;
    } catch { return null; }
  }

  // ──────────────────────────────────────────────
  // 개별 상품 페이지
  // ──────────────────────────────────────────────
  function extractSingleItem() {
    try {
      const ld = jsonLd();
      const itemId = url.match(/\/item\/([^/?#]+)/)?.[1] || null;

      const price = parsePrice(
        ld?.offers?.price ||
        document.querySelector('[itemprop="price"]')?.content ||
        textOf(document.querySelector('.price, .js-price, [class*="price"]'))
      );

      const name =
        ld?.name ||
        textOf(document.querySelector('[itemprop="name"], h1, .item-name')) ||
        document.title.replace(/\s*[|–—\-].*$/, '').trim();

      const seller =
        ld?.seller?.name ||
        textOf(document.querySelector('[itemprop="seller"] [itemprop="name"], .seller-name, [class*="seller"], [class*="buyer"]'));

      const brand =
        ld?.brand?.name ||
        textOf(document.querySelector('[itemprop="brand"], .brand-name, [class*="brand"]'));

      const imgEl = document.querySelector('[itemprop="image"], .main-image img, .item-img img');
      const imageUrl = imgEl?.src || imgEl?.getAttribute('content') || null;

      const soldOut = !!document.querySelector('[class*="soldout"], [class*="sold-out"], .js-soldout');
      const availEl = document.querySelector('[itemprop="availability"]');
      const inStock = availEl
        ? (availEl.content || availEl.getAttribute('content') || '').includes('InStock')
        : !soldOut;

      const ratingEl = document.querySelector('.seller-rating, [class*="rating"], [class*="stars"]');
      const sellerRating = ratingEl ? parsePrice(ratingEl.textContent) : null;

      return {
        buyma_item_id: itemId,
        buyma_url: url,
        item_name: name,
        brand,
        seller_name: seller,
        seller_rating: sellerRating,
        price_jpy: price,
        is_in_stock: inStock,
        image_url: imageUrl,
        page_type: 'item',
        rank_position: null,
        search_keyword: null,
      };
    } catch (e) {
      console.error('[BUYMA Monitor] extractSingleItem 실패', e);
      return null;
    }
  }

  // ──────────────────────────────────────────────
  // 목록 페이지 (검색/브랜드)
  // ──────────────────────────────────────────────
  function extractListItems() {
    const keyword = new URLSearchParams(location.search).get('search[keyword]') ||
                    new URLSearchParams(location.search).get('keyword') || null;

    // 다양한 BUYMA 버전 셀렉터 순차 시도
    const CONTAINER_SELECTORS = [
      '.js-itemBox', '.item-box', '[data-item-id]',
      '.sc-item', '.item-list-item', '[class*="ItemBox"]',
    ];
    let containers = [];
    for (const sel of CONTAINER_SELECTORS) {
      containers = Array.from(document.querySelectorAll(sel));
      if (containers.length > 0) break;
    }

    // fallback: 상품 링크 수집
    if (containers.length === 0) {
      const seen = new Set();
      const links = Array.from(document.querySelectorAll('a[href*="/item/"]'));
      return links
        .filter(a => {
          const id = a.href.match(/\/item\/([^/?#]+)/)?.[1];
          if (!id || seen.has(id)) return false;
          seen.add(id);
          return true;
        })
        .slice(0, 40)
        .map((a, idx) => ({
          buyma_item_id: a.href.match(/\/item\/([^/?#]+)/)?.[1] || null,
          buyma_url: a.href,
          item_name: a.title || textOf(a) || null,
          brand: null,
          seller_name: null,
          seller_rating: null,
          price_jpy: null,
          is_in_stock: true,
          image_url: null,
          page_type: pageType,
          rank_position: idx + 1,
          search_keyword: keyword,
        }));
    }

    return containers.slice(0, 40).map((el, idx) => {
      try {
        const link = el.querySelector('a[href*="/item/"]');
        const href = link?.href || '';
        const itemId = href.match(/\/item\/([^/?#]+)/)?.[1] || null;

        const price = parsePrice(textOf(el.querySelector(
          '.price, [class*="price"], [itemprop="price"]'
        )));

        const name = textOf(el.querySelector(
          '.item-name, [class*="name"], [class*="title"], h2, h3'
        )) || link?.title || null;

        const seller = textOf(el.querySelector(
          '[class*="seller"], [class*="buyer"], [class*="Seller"]'
        ));

        const imgEl = el.querySelector('img[src], img[data-src]');
        const imageUrl = imgEl?.src || imgEl?.dataset?.src || null;

        const soldOut = !!el.querySelector('[class*="soldout"], [class*="sold-out"]');

        return {
          buyma_item_id: itemId,
          buyma_url: href || null,
          item_name: name,
          brand: null,
          seller_name: seller,
          seller_rating: null,
          price_jpy: price,
          is_in_stock: !soldOut,
          image_url: imageUrl,
          page_type: pageType,
          rank_position: idx + 1,
          search_keyword: keyword,
        };
      } catch { return null; }
    }).filter(Boolean);
  }

  // ──────────────────────────────────────────────
  // 실행: 페이지 완전 로드 후 3초 대기
  // ──────────────────────────────────────────────
  setTimeout(() => {
    const items = isItemPage ? [extractSingleItem()].filter(Boolean) : extractListItems();
    if (items.length === 0) return;

    chrome.runtime.sendMessage({
      type: 'BUYMA_ITEMS_CAPTURED',
      items,
      capturedAt: new Date().toISOString(),
      pageUrl: url,
      pageType,
    });
  }, 3000);
})();

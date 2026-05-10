/**
 * 스크래퍼 엔진 — 네이버 쇼핑 API로 products 테이블의 source_url/thumbnail_url/cost_krw 채우기
 * 매일 20:00 UTC (05:00 JST) 자동 실행 — 소싱 엔진 1시간 후
 */

import { createClient } from '@supabase/supabase-js';

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase 환경변수 미설정');
  return createClient(url, key);
}

interface NaverShopItem {
  title: string;
  link: string;
  image: string;
  lprice: string; // 최저가 (KRW 문자열)
  mallName: string;
  brand: string;
}

interface NaverShopResponse {
  items: NaverShopItem[];
}

async function searchNaver(query: string): Promise<NaverShopItem | null> {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 미설정');

  const url = `https://openapi.naver.com/v1/search/shop.json?query=${encodeURIComponent(query)}&display=5&sort=sim`;
  const res = await fetch(url, {
    headers: {
      'X-Naver-Client-Id': clientId,
      'X-Naver-Client-Secret': clientSecret,
    },
  });

  if (!res.ok) {
    console.error(`[scraper] 네이버 API 오류 ${res.status}: ${query}`);
    return null;
  }

  const data: NaverShopResponse = await res.json();
  return data.items?.[0] ?? null;
}

function stripHtmlTags(str: string) {
  return str.replace(/<[^>]+>/g, '');
}

export interface ScraperRunResult {
  updated: number;
  failed: number;
  skipped: number;
  ran_at: string;
}

export type ScraperMode = 'new' | 'thumbnails';

export async function runDailyScraper(mode: ScraperMode = 'new'): Promise<ScraperRunResult> {
  const supabase = getAdminSupabase();
  const ranAt = new Date().toISOString();

  // mode=new: source_url 없는 신규 / mode=thumbnails: thumbnail_url만 없는 것
  let q = supabase
    .from('products')
    .select('id, name_kr, brand, source_mall, source_url, thumbnail_url')
    .neq('status', 'skipped')
    .order('created_at', { ascending: false })
    .limit(50);

  q = mode === 'thumbnails'
    ? q.is('thumbnail_url', null)
    : q.is('source_url', null).eq('status', 'sourcing');

  const { data: products, error: fetchError } = await q;

  if (fetchError) throw new Error(`products 조회 실패: ${fetchError.message}`);
  if (!products || products.length === 0) {
    return { updated: 0, failed: 0, skipped: 0, ran_at: ranAt };
  }

  let updated = 0;
  let failed = 0;
  let skipped = 0;

  for (const product of products) {
    // 광범위 쿼리: full → without brand → 첫 2단어 (썸네일 모드에서 점진적 fallback)
    const queries = product.brand
      ? [
          `${product.brand} ${product.name_kr}`,
          product.name_kr,
          product.name_kr.split(/\s+/).slice(0, 2).join(' '),
        ]
      : [
          product.name_kr,
          product.name_kr.split(/\s+/).slice(0, 2).join(' '),
        ];
    const uniqueQueries = [...new Set(queries.filter((s) => s && s.length >= 2))];

    try {
      let item = null;
      for (const query of uniqueQueries) {
        item = await searchNaver(query);
        if (item?.image) break; // 이미지 있는 결과 발견 시 중단
        await new Promise((r) => setTimeout(r, 120));
      }
      if (!item) { skipped++; continue; }

      const costKrw = parseInt(item.lprice, 10);
      const updatePayload: Record<string, unknown> = {
        thumbnail_url: item.image || product.thumbnail_url,
      };
      // 신규 모드에서만 source_url/cost/mall 덮어씀 (썸네일 모드는 보존)
      if (mode === 'new') {
        updatePayload.source_url = item.link;
        updatePayload.cost_krw = isNaN(costKrw) ? undefined : costKrw;
        updatePayload.source_mall = item.mallName || product.source_mall;
      } else if (!product.source_url && item.link) {
        // 썸네일 모드라도 source_url이 비어 있으면 채워줌
        updatePayload.source_url = item.link;
      }

      const { error: updateError } = await supabase
        .from('products')
        .update(updatePayload)
        .eq('id', product.id);

      if (updateError) {
        console.error(`[scraper] update 오류 id=${product.id}:`, updateError);
        failed++;
      } else {
        updated++;
      }

      // 네이버 API rate limit 방지 (10 req/s)
      await new Promise((r) => setTimeout(r, 120));
    } catch (e) {
      console.error(`[scraper] 검색 실패 "${product.name_kr}":`, e);
      failed++;
    }
  }

  // activity_feed 기록
  await supabase.from('activity_feed').insert({
    user_id: null,
    actor_label: '스크래퍼 엔진',
    action_type: mode === 'thumbnails' ? 'thumbnail_refresh_run' : 'daily_scraper_run',
    target_type: 'products_batch',
    target_id: null,
    target_label: mode === 'thumbnails'
      ? `썸네일 재수집 ${updated}개 완료`
      : `가격/URL 수집 ${updated}개 완료`,
    details: { total: products.length, updated, failed, skipped, mode, ran_at: ranAt },
  });

  return { updated, failed, skipped, ran_at: ranAt };
}

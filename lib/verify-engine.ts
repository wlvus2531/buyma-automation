/**
 * 검증 엔진 — v4 P2
 *
 * 흐름 (방법 A의 마진 검증 단계 자동화):
 * 1. 수요 조건 충족 후보 선별: 등록 90일 이내 + (찜 3+ 또는 조회 100+)
 * 2. 네이버 쇼핑에서 구매처 후보 탐색 → 금지 사이트 제외, 화이트리스트 우선
 * 3. 마진 계산 (환급 전/후) → 환급 후 5% 이상이면 products로 승격
 * 4. 근거(evidence)를 products에 저장 → 셀렉 UI에서 "왜 이 상품인가" 표시
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { loadBrandRules, checkSource, isWhitelistedSource, BrandRule } from './brand-rules';
import { calcMargin, fetchKrwPerJpy, MIN_MARGIN_PCT } from './margin-calc';
import { sleep } from './buyma-scraper';

interface NaverItem {
  title: string;
  link: string;
  lprice: string;
  mallName: string;
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, '');
}

/** 일본어 상품명에서 네이버 검색용 쿼리 추출 (브랜드 + 영문 토큰) */
export function buildSearchQuery(brand: string | null, nameJp: string | null): string | null {
  const latinTokens = (nameJp ?? '')
    .replace(/[【】\[\]★☆♪◆■◎「」『』()（）]/g, ' ')
    .match(/[A-Za-z][A-Za-z0-9&.'-]{1,}/g) ?? [];
  const brandNorm = (brand ?? '').toLowerCase();
  const tokens = latinTokens
    .filter((t) => !brandNorm.includes(t.toLowerCase()) && !/^(the|and|for|with|of)$/i.test(t))
    .slice(0, 4);
  const parts = [brand, ...tokens].filter(Boolean);
  if (parts.length === 0) return null;
  return parts.join(' ').slice(0, 60);
}

async function searchNaver(query: string): Promise<NaverItem[]> {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('네이버 API 키 미설정');

  const url = `https://openapi.naver.com/v1/search/shop.json?query=${encodeURIComponent(query)}&display=10&sort=sim`;
  const res = await fetch(url, {
    headers: { 'X-Naver-Client-Id': clientId, 'X-Naver-Client-Secret': clientSecret },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.items ?? []) as NaverItem[];
}

interface SourceCandidate {
  mall: string;
  url: string;
  title: string;
  price_krw: number;
  is_whitelisted: boolean;
}

/** 네이버 결과 → 금지 사이트 제외 + 화이트리스트 우선 + 저가순 */
export function rankSources(items: NaverItem[], rules: BrandRule[]): SourceCandidate[] {
  const out: SourceCandidate[] = [];
  for (const it of items) {
    const price = parseInt(it.lprice, 10);
    if (!price || price < 1000) continue;
    const target = `${it.mallName} ${it.link}`;
    if (!checkSource(target, rules).allowed) continue; // 금지 구매처 제외
    out.push({
      mall: it.mallName,
      url: it.link,
      title: stripTags(it.title),
      price_krw: price,
      is_whitelisted: isWhitelistedSource(target, rules),
    });
  }
  // 화이트리스트 우선, 그 안에서 저가순
  return out.sort((a, b) =>
    (b.is_whitelisted ? 1 : 0) - (a.is_whitelisted ? 1 : 0) || a.price_krw - b.price_krw
  ).slice(0, 3);
}

export interface VerifyRunResult {
  checked: number;
  promoted: number;
  rejected_margin: number;
  no_source: number;
  errors: string[];
}

export async function runVerification(
  supabase: SupabaseClient,
  opts: { limit?: number } = {}
): Promise<VerifyRunResult> {
  const limit = opts.limit ?? 10;
  const result: VerifyRunResult = { checked: 0, promoted: 0, rejected_margin: 0, no_source: 0, errors: [] };

  // 1. 수요 조건: 90일 이내 등록 + (찜 3+ 또는 조회 100+), enriched 상태
  const cutoff = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
  const { data: candidates } = await supabase
    .from('buyma_candidates')
    .select('id, buyma_item_id, buyma_url, name_jp, brand, price_jpy, wish_count, access_count, listed_date, seller_name, image_url, method')
    .eq('status', 'enriched')
    .gte('listed_date', cutoff)
    .or('wish_count.gte.3,access_count.gte.100')
    .not('price_jpy', 'is', null)
    .order('wish_count', { ascending: false, nullsFirst: false })
    .limit(limit);

  if (!candidates?.length) return result;

  const rules = await loadBrandRules(supabase);
  const krwPerJpy = await fetchKrwPerJpy();

  for (const c of candidates) {
    result.checked++;
    try {
      const query = buildSearchQuery(c.brand, c.name_jp);
      if (!query) {
        await supabase.from('buyma_candidates').update({ status: 'no_source' }).eq('id', c.id);
        result.no_source++;
        continue;
      }

      const naverItems = await searchNaver(query);
      const sources = rankSources(naverItems, rules);

      if (sources.length === 0) {
        await supabase.from('buyma_candidates').update({ status: 'no_source' }).eq('id', c.id);
        result.no_source++;
        await sleep(150);
        continue;
      }

      // 구매처 후보 저장
      await supabase.from('purchase_sources').delete().eq('candidate_id', c.id);
      await supabase.from('purchase_sources').insert(
        sources.map((s, i) => ({ candidate_id: c.id, ...s, rank: i }))
      );

      // 2. 마진 계산 — 최우선 구매처 기준
      const best = sources[0];
      const margin = calcMargin({
        costKrw: best.price_krw,
        sellPriceJpy: c.price_jpy,
        krwPerJpy,
      });

      const evidence = {
        wish_count: c.wish_count,
        access_count: c.access_count,
        listed_date: c.listed_date,
        buyma_price_jpy: c.price_jpy,
        buyma_url: c.buyma_url,
        competitor_seller: c.seller_name,
        source_query: query,
        source_whitelisted: best.is_whitelisted,
        margin_before: margin.margin_pct,
        margin_after_refund: margin.margin_pct_after_refund,
        vat_refund_krw: margin.vat_refund_krw,
        krw_per_jpy: krwPerJpy,
        method: c.method,
      };

      if (!margin.passes) {
        await supabase.from('buyma_candidates')
          .update({ status: 'rejected_margin', raw: evidence })
          .eq('id', c.id);
        result.rejected_margin++;
        await sleep(150);
        continue;
      }

      // 3. 승격: products에 근거와 함께 insert (중복 방지: candidate_id 기준)
      const { data: existing } = await supabase
        .from('products').select('id').eq('candidate_id', c.id).maybeSingle();

      if (!existing) {
        const { data: inserted, error: insErr } = await supabase.from('products').insert({
          name_kr: best.title.slice(0, 200),
          name_jp: c.name_jp,
          brand: c.brand,
          source_url: best.url,
          source_mall: best.mall,
          cost_krw: best.price_krw,
          ship_krw: 3000,
          list_price_jpy: c.price_jpy,
          margin_pct: margin.margin_pct_after_refund,
          status: 'sourcing',
          thumbnail_url: c.image_url,
          candidate_id: c.id,
          evidence,
        }).select('id').single();

        if (insErr) throw new Error(insErr.message);
        await supabase.from('purchase_sources')
          .update({ product_id: inserted.id })
          .eq('candidate_id', c.id);
      }

      await supabase.from('buyma_candidates').update({ status: 'promoted', raw: evidence }).eq('id', c.id);
      result.promoted++;
      await sleep(150); // 네이버 rate limit
    } catch (e) {
      result.errors.push(`${c.buyma_item_id}: ${e instanceof Error ? e.message : e}`);
    }
  }

  await supabase.from('activity_feed').insert({
    user_id: null,
    actor_label: '검증 엔진',
    action_type: 'verification_run',
    target_type: 'verify_batch',
    target_label: `검증 ${result.checked}건 · 승격 ${result.promoted}건 (환급후 ${MIN_MARGIN_PCT}%+ 기준)`,
    details: result as unknown as Record<string, unknown>,
  });

  return result;
}

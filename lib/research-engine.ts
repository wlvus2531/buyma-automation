/**
 * 리서치 엔진 — v4 P1
 *
 * 방법 A(인기상품 리서치)의 "입구 선정 → 세분화" 단계를 미션으로 자동 생성.
 * Chrome 확장(수집기)이 미션의 entry_url을 방문해 실측 데이터를 수집한다.
 *
 * 입구 로테이션: 매일 다른 카테고리 입구에서 시작 (강의 방법론 그대로)
 */

import { SupabaseClient } from '@supabase/supabase-js';

/**
 * 바이마 검색 입구 템플릿.
 * '한국' 키워드 + 카테고리 + 인기순 정렬.
 * URL 파라미터는 확장 수집 결과를 보고 계속 보정한다 (V-검증 대상).
 */
interface Entrance {
  label: string;
  categoryId?: string; // 바이마 카테고리 코드
  keyword: string;
}

const ENTRANCES: Entrance[] = [
  { label: '레디스 모자/캡',      categoryId: '4468', keyword: '韓国' },
  { label: '레디스 니트/스웨터',  categoryId: '2201', keyword: '韓国' },
  { label: '레디스 원피스',       categoryId: '2203', keyword: '韓国' },
  { label: '레디스 가방',         categoryId: '2100', keyword: '韓国' },
  { label: '레디스 악세서리',     categoryId: '2323', keyword: '韓国' },
  { label: '맨즈 톱스',           categoryId: '5344', keyword: '韓国' },
  { label: '맨즈 신발',           categoryId: '5399', keyword: '韓国' },
  { label: '맨즈 악세서리',       categoryId: '5445', keyword: '韓国' },
  { label: '라이프스타일 잡화',   categoryId: '3000', keyword: '韓国' },
  { label: '뷰티/코스메틱',       categoryId: '3300', keyword: '韓国' },
];

/** 인기순 목록 URL 생성 (한국발 필터) — O1=인기순 (실측 검증 완료) */
function buildEntryUrl(e: Entrance, page: number): string {
  const base = `https://www.buyma.com/r/-C${e.categoryId ?? ''}O1/${encodeURIComponent(e.keyword)}`;
  return page > 1 ? `${base}_${page}/` : `${base}/`;
}

export interface MissionGenResult {
  created: number;
  date: string;
  labels: string[];
}

/**
 * 오늘의 미션 생성 — 입구 2개 로테이션 × 페이지 3~5 (1~2페이지 초인기 제외)
 * 이미 오늘 미션이 있으면 스킵 (멱등)
 */
export async function generateDailyMissions(supabase: SupabaseClient): Promise<MissionGenResult> {
  const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10); // KST

  const { count } = await supabase
    .from('research_missions')
    .select('id', { count: 'exact', head: true })
    .eq('mission_date', today);

  if ((count ?? 0) > 0) {
    return { created: 0, date: today, labels: [] };
  }

  // 날짜 기반 로테이션: 매일 입구 2개씩 순환
  const dayIndex = Math.floor(Date.now() / 86400000);
  const picked = [
    ENTRANCES[dayIndex % ENTRANCES.length],
    ENTRANCES[(dayIndex + Math.floor(ENTRANCES.length / 2)) % ENTRANCES.length],
  ];

  const rows: Record<string, unknown>[] = [];
  for (const e of picked) {
    // 방법론: 1~2페이지(초인기·대량셀러 영역) 제외 → 3~5페이지 수집
    for (const page of [3, 4, 5]) {
      rows.push({
        mission_date: today,
        method: 'A',
        label: `${e.label} · 인기순 p${page}`,
        entry_url: buildEntryUrl(e, page),
        priority: page === 3 ? 2 : 1,
      });
    }
  }

  const { error } = await supabase.from('research_missions').insert(rows);
  if (error) throw new Error(`미션 생성 실패: ${error.message}`);

  await supabase.from('activity_feed').insert({
    user_id: null,
    actor_label: '리서치 엔진',
    action_type: 'research_missions_generated',
    target_type: 'research_batch',
    target_label: `리서치 미션 ${rows.length}개 생성`,
    details: { date: today, entrances: picked.map((e) => e.label) },
  });

  return { created: rows.length, date: today, labels: picked.map((e) => e.label) };
}

// ────────────────────────────────────────────────
// 서버사이드 수집 (v4 P1 — 확장 없이 Vercel에서 직접 수집)
// ────────────────────────────────────────────────

import { fetchBuymaHtml, parseListPage, parseItemPage, sleep } from './buyma-scraper';
import { loadBrandRules, checkBrand } from './brand-rules';

export interface CollectionRunResult {
  missions_run: number;
  saved: number;
  discarded: number;
  enriched: number;
  errors: string[];
}

/**
 * 오늘의 pending 미션을 서버에서 직접 수집 실행
 * - 미션당 3~4초 간격 (rate limit 배려)
 * - 하드 필터 즉시 적용, 프리미엄 쇼퍼 상품 제외(방법론)
 * - 수집 후 유망 후보 상위 N개 상세 페이지에서 찜/조회수 보강
 */
export async function runResearchCollection(
  supabase: SupabaseClient,
  opts: { missionLimit?: number } = {}
): Promise<CollectionRunResult & { remaining: number }> {
  const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  const missionLimit = opts.missionLimit ?? 3; // 타임아웃 방지: 호출당 최대 3개 미션

  const { data: allPending } = await supabase
    .from('research_missions')
    .select('id, label, entry_url, method')
    .eq('mission_date', today)
    .in('status', ['pending', 'failed', 'running']) // running = 이전 호출 타임아웃 잔여물도 재수집
    .order('priority', { ascending: false });

  const result: CollectionRunResult & { remaining: number } = {
    missions_run: 0, saved: 0, discarded: 0, enriched: 0, errors: [], remaining: 0,
  };
  const missions = (allPending ?? []).slice(0, missionLimit);
  result.remaining = Math.max(0, (allPending?.length ?? 0) - missions.length);
  if (!missions.length) return result;

  const rules = await loadBrandRules(supabase);
  const now = new Date().toISOString();

  for (const mission of missions) {
    try {
      await supabase.from('research_missions').update({ status: 'running' }).eq('id', mission.id);
      const html = await fetchBuymaHtml(mission.entry_url);
      const items = parseListPage(html);

      // 배치 upsert (개별 호출 대비 ~50배 빠름)
      const rows = items
        .filter((it) => it.seller_type !== 'premium') // 방법론: 프리미엄 쇼퍼 제외
        .map((it) => {
          const brandCheck = checkBrand(it.brand, rules);
          if (!brandCheck.allowed) result.discarded++;
          return {
            buyma_item_id: it.buyma_item_id,
            buyma_url: it.buyma_url,
            name_jp: it.name_jp,
            brand: it.brand,
            price_jpy: it.price_jpy,
            listed_date: parseListedDateFromImageUrl(it.image_url),
            seller_id: it.seller_id,
            seller_name: it.seller_name,
            seller_type: it.seller_type,
            rank_position: it.rank_position,
            image_url: it.image_url,
            mission_id: mission.id,
            method: mission.method,
            status: brandCheck.allowed ? 'collected' : 'discarded',
            raw: { category: it.category },
            last_seen_at: now,
          };
        });
      result.discarded += items.length - rows.length; // premium 제외분

      const { error } = await supabase
        .from('buyma_candidates')
        .upsert(rows, { onConflict: 'buyma_item_id' });
      if (error) throw new Error(error.message);

      const saved = rows.filter((r) => r.status === 'collected').length;
      result.saved += saved;

      await supabase.from('research_missions')
        .update({ status: 'done', items_collected: saved, completed_at: new Date().toISOString() })
        .eq('id', mission.id);
      result.missions_run++;
      await sleep(2000 + Math.random() * 1000);
    } catch (e) {
      result.errors.push(`${mission.label}: ${e instanceof Error ? e.message : e}`);
      await supabase.from('research_missions').update({ status: 'failed' }).eq('id', mission.id);
    }
  }

  await supabase.from('activity_feed').insert({
    user_id: null,
    actor_label: '리서치 수집기',
    action_type: 'research_collection_run',
    target_type: 'research_batch',
    target_label: `서버 수집 ${result.missions_run}개 미션 · 후보 ${result.saved}개`,
    details: result as unknown as Record<string, unknown>,
  });

  return result;
}

/**
 * 보강: 찜/조회수 없는 후보 상세 페이지 수집 (별도 호출 — 타임아웃 분리)
 */
export async function runEnrichment(
  supabase: SupabaseClient,
  opts: { limit?: number } = {}
): Promise<{ enriched: number; errors: string[] }> {
  const limit = opts.limit ?? 15;
  // 인기순 상위(rank 낮음) 우선 — 찜/조회가 실제로 붙어있을 확률이 높은 순서
  const { data: toEnrich } = await supabase
    .from('buyma_candidates')
    .select('id, buyma_url')
    .eq('status', 'collected')
    .is('wish_count', null)
    .order('rank_position', { ascending: true, nullsFirst: false })
    .limit(limit);

  const out = { enriched: 0, errors: [] as string[] };
  for (const c of toEnrich ?? []) {
    try {
      const html = await fetchBuymaHtml(c.buyma_url);
      const d = parseItemPage(html);
      await supabase.from('buyma_candidates').update({
        wish_count: d.wish_count ?? 0,
        access_count: d.access_count,
        listed_date: d.listed_date ?? undefined,
        status: 'enriched',
        last_seen_at: new Date().toISOString(),
      }).eq('id', c.id);
      out.enriched++;
      await sleep(1500 + Math.random() * 1000);
    } catch (e) {
      out.errors.push(`${c.id}: ${e instanceof Error ? e.message : e}`);
    }
  }
  return out;
}

/**
 * V1 기법: 바이마 썸네일 URL에서 등록일 추출
 * 예: https://static-buyma-com.akamaized.net/imgdata/item/250412/12345678.jpg → 2025-04-12
 */
export function parseListedDateFromImageUrl(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null;
  const m = imageUrl.match(/\/(?:item|imgdata\/item)\/(\d{6})\//) || imageUrl.match(/\/(\d{6})\/\d+(?:_\d+)?\.(?:jpg|jpeg|png|webp)/i);
  if (!m) return null;
  const [yy, mm, dd] = [m[1].slice(0, 2), m[1].slice(2, 4), m[1].slice(4, 6)];
  const year = 2000 + parseInt(yy, 10);
  const month = parseInt(mm, 10);
  const day = parseInt(dd, 10);
  if (year < 2005 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${mm}-${dd}`;
}

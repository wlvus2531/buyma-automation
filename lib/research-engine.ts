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

/** 인기순 목록 URL 생성 (한국발 필터) */
function buildEntryUrl(e: Entrance, page: number): string {
  // 바이마 검색: /r/{keyword}/ + 카테고리/정렬 파라미터 (수집기 실측으로 보정 예정)
  const base = `https://www.buyma.com/r/-C${e.categoryId ?? ''}O2/${encodeURIComponent(e.keyword)}`;
  // O2 = 인기순 정렬 코드 (검증 대상 V7)
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

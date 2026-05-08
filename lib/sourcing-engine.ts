/**
 * AI 소싱 엔진 — 매일 새벽 4시 (JST) 자동 실행
 * Claude API로 30개 상품 추출 → Supabase products 저장
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase 환경변수 미설정 (URL 또는 SERVICE_ROLE_KEY)');
  return createClient(url, key);
}

export interface SourcingCandidate {
  name_kr: string;
  name_jp: string;
  brand: string;
  source_mall: string;
  cost_krw: number;
  ship_krw: number;
  list_price_jpy: number;
  margin_pct: number;
  ai_score: number;
  ai_reason: string;
  category: string;
  trend_keyword: string;
}

export interface SourcingRunResult {
  saved: number;
  skipped: number;
  candidates: SourcingCandidate[];
  ran_at: string;
}

const CATEGORY_BATCHES = [
  { label: '패션/의류·잡화', count: 12, hint: '의류, 가방, 신발, 모자, 악세서리' },
  { label: '뷰티/화장품', count: 10, hint: '스킨케어, 메이크업, 헤어케어, 향수' },
  { label: '라이프스타일', count: 8, hint: '홈인테리어, 식품, 문화상품, 건강기능식품' },
];

function getSeason(month: number) {
  if (month >= 3 && month <= 5) return '봄';
  if (month >= 6 && month <= 8) return '여름';
  if (month >= 9 && month <= 11) return '가을';
  return '겨울';
}

async function callClaude(client: Anthropic, category: { label: string; count: number; hint: string }, date: Date): Promise<SourcingCandidate[]> {
  const month = date.getMonth() + 1;
  const season = getSeason(month);

  const prompt = `당신은 바이마(BUYMA) 한국→일본 역직구 전문 소싱 AI입니다.
현재: ${date.toLocaleDateString('ko-KR')} (${month}월, ${season})
카테고리: ${category.label} (${category.hint})

일본 바이마에서 한국 셀러로부터 구매 수요가 높을 상품 ${category.count}개를 추천하세요.

조건:
- 일본에서 구하기 어렵거나 한국 브랜드만의 특색이 있는 상품
- 마진율 15% 이상 가능한 상품 우선
- 경쟁 셀러가 적은 틈새 상품 선호
- K-아이돌 착용/언급 브랜드 포함: Thug Club, SCULPTOR, Matin Kim, LUV IS TRUE, THEAIRTOWN, ADLV, COVERNAT
- ${season} 시즌에 적합한 상품

반드시 아래 JSON 배열 형식만 출력 (코드블록 없이):
[
  {
    "name_kr": "상품명 한국어",
    "name_jp": "商品名日本語",
    "brand": "브랜드명",
    "source_mall": "구매처 (예: 무신사, 올리브영, 네이버쇼핑, 브랜드 공홈)",
    "cost_krw": 35000,
    "ship_krw": 3500,
    "list_price_jpy": 8000,
    "margin_pct": 22,
    "ai_score": 85,
    "ai_reason": "추천 근거 2문장 이내",
    "category": "${category.label}",
    "trend_keyword": "관련 트렌드 키워드"
  }
]

ai_score 기준 (0~100):
- 90+: 아이돌 착용 확인 + 경쟁 없음 + 마진 20%+
- 80~89: 명확한 수요 + 마진 15%+ + 일본 미출시
- 70~79: 가능성 있으나 불확실성 존재
cost_krw, ship_krw, list_price_jpy는 실제 가능한 수치로 추정`;

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = message.content[0].type === 'text' ? message.content[0].text : '';
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  let parsed: SourcingCandidate[];
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (!match) throw new Error(`Claude 응답 파싱 실패: ${cleaned.slice(0, 200)}`);
    parsed = JSON.parse(match[0]);
  }

  return parsed;
}

export async function runDailySourcing(): Promise<SourcingRunResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY 미설정');

  const client = new Anthropic({ apiKey });
  const supabase = getAdminSupabase();
  const now = new Date();
  const ranAt = now.toISOString();

  // 3개 카테고리 순차 호출 (병렬 시 rate limit 위험)
  const allCandidates: SourcingCandidate[] = [];
  for (const batch of CATEGORY_BATCHES) {
    try {
      const items = await callClaude(client, batch, now);
      allCandidates.push(...items);
    } catch (e) {
      console.error(`[sourcing-engine] ${batch.label} 배치 실패:`, e);
    }
  }

  if (allCandidates.length === 0) {
    throw new Error('모든 카테고리 배치 실패');
  }

  // Supabase upsert — 같은 날 같은 name_kr은 덮어씀
  const rows = allCandidates.map((c) => ({
    name_kr: c.name_kr,
    name_jp: c.name_jp || null,
    brand: c.brand || null,
    source_mall: c.source_mall || null,
    cost_krw: c.cost_krw ?? 0,
    ship_krw: c.ship_krw ?? 0,
    list_price_jpy: c.list_price_jpy || null,
    margin_pct: c.margin_pct || null,
    status: 'sourcing' as const,
    ai_score: c.ai_score ?? null,
    thumbnail_url: null,
    source_url: null,
  }));

  const { data: inserted, error } = await supabase
    .from('products')
    .upsert(rows, { onConflict: 'name_kr' })
    .select('id');

  if (error) {
    console.error('[sourcing-engine] upsert 오류:', error);
    throw new Error(`DB 저장 실패: ${error.message}`);
  }

  const saved = inserted?.length ?? 0;
  const skipped = allCandidates.length - saved;

  // activity_feed 기록
  await supabase.from('activity_feed').insert({
    user_id: null,
    actor_label: 'AI 소싱 엔진',
    action_type: 'daily_sourcing_run',
    target_type: 'sourcing_batch',
    target_id: null,
    target_label: `일일 소싱 ${allCandidates.length}개 완료`,
    details: {
      total: allCandidates.length,
      saved,
      skipped,
      categories: CATEGORY_BATCHES.map((b) => b.label),
      ran_at: ranAt,
    },
  });

  return { saved, skipped, candidates: allCandidates, ran_at: ranAt };
}

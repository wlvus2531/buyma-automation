/**
 * 번역 엔진 — Claude API로 name_jp 없는 products 일괄 번역
 * 매일 21:00 UTC (06:00 JST) 자동 실행
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase 환경변수 미설정');
  return createClient(url, key);
}

interface TranslationItem {
  id: string;
  name_kr: string;
  brand: string | null;
}

interface TranslationResult {
  id: string;
  name_jp: string;
}

async function translateBatch(
  client: Anthropic,
  items: TranslationItem[]
): Promise<TranslationResult[]> {
  const list = items
    .map((it) => `${it.id}|${it.brand ?? ''}|${it.name_kr}`)
    .join('\n');

  const prompt = `당신은 한국 쇼핑몰 상품명을 일본어(바이마 출품용)로 번역하는 전문가입니다.

아래 상품 목록을 일본어로 번역하세요.
형식: ID|브랜드|한국어상품명

번역 규칙:
- 브랜드명은 영문 그대로 유지 (예: SCULPTOR, Matin Kim)
- 한국 고유명사는 가타카나 또는 영문으로
- 바이마 검색에 유리한 자연스러운 일본어
- 색상/소재/특징을 명확히 포함
- 반드시 아래 JSON 배열만 출력 (코드블록 없이)

상품 목록:
${list}

출력 형식:
[{"id":"...", "name_jp":"..."}]`;

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = message.content[0].type === 'text' ? message.content[0].text : '';
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  let parsed: TranslationResult[];
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (!match) throw new Error(`번역 파싱 실패: ${cleaned.slice(0, 200)}`);
    parsed = JSON.parse(match[0]);
  }

  return parsed;
}

export interface TranslationRunResult {
  translated: number;
  failed: number;
  ran_at: string;
}

export async function runDailyTranslation(): Promise<TranslationRunResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY 미설정');

  const client = new Anthropic({ apiKey });
  const supabase = getAdminSupabase();
  const ranAt = new Date().toISOString();

  // name_jp가 없는 상품 (최대 60개, 배치당 20개)
  const { data: products, error } = await supabase
    .from('products')
    .select('id, name_kr, brand')
    .is('name_jp', null)
    .order('created_at', { ascending: false })
    .limit(60);

  if (error) throw new Error(`products 조회 실패: ${error.message}`);
  if (!products || products.length === 0) {
    return { translated: 0, failed: 0, ran_at: ranAt };
  }

  let translated = 0;
  let failed = 0;
  const BATCH_SIZE = 20;

  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE);
    try {
      const results = await translateBatch(client, batch);

      for (const result of results) {
        if (!result.id || !result.name_jp) continue;
        const { error: updateError } = await supabase
          .from('products')
          .update({ name_jp: result.name_jp })
          .eq('id', result.id);

        if (updateError) {
          failed++;
        } else {
          translated++;
        }
      }
    } catch (e) {
      console.error(`[translation] 배치 ${i / BATCH_SIZE + 1} 실패:`, e);
      failed += batch.length;
    }
  }

  await supabase.from('activity_feed').insert({
    user_id: null,
    actor_label: '번역 엔진',
    action_type: 'daily_translation_run',
    target_type: 'products_batch',
    target_id: null,
    target_label: `일본어 번역 ${translated}개 완료`,
    details: { total: products.length, translated, failed, ran_at: ranAt },
  });

  return { translated, failed, ran_at: ranAt };
}

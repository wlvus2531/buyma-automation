/**
 * 등록 엔진 — AI 소싱 완료 상품에 바이마 출품 자료 생성
 * 매일 22:00 UTC (07:00 JST) 자동 실행
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { maybeRequestApprovalForListing } from './approval-rules';
import { loadBrandRules, checkBrand } from './brand-rules';
import { buildTitle, buildProductComment, buildSizeColorComment } from './listing-templates';

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase 환경변수 미설정');
  return createClient(url, key);
}

interface ListingProduct {
  id: string;
  name_kr: string;
  name_jp: string;
  brand: string | null;
  source_mall: string | null;
  cost_krw: number;
  ship_krw: number;
  list_price_jpy: number | null;
  margin_pct: number | null;
  ai_score: number | null;
}

interface ListingData {
  title_jp: string;
  description_jp: string;    // 상품 코멘트 (템플릿 + AI 특징 삽입 완성본)
  size_comment_jp: string;  // 색·사이즈 보충 (템플릿 + AI 상세 삽입 완성본)
  buyma_category: string;
  listing_tags: string[];
}

// AI가 생성하는 가변 부분만 (고정 템플릿은 코드에서 조립)
interface ListingAiParts {
  title_core: string;   // 브랜드+상품타입+특징 (키워드 제외)
  intro: string;        // 상품 특징 3~5행 (경어)
  size_detail: string;  // 색/사이즈 설명
  buyma_category: string;
  listing_tags: string[];
}

async function generateListing(
  client: Anthropic,
  product: ListingProduct
): Promise<ListingData> {
  const prompt = `あなたはBUYMA出品の専門家です。以下の韓国商品情報から出品データの「可変部分」だけを日本語で生成してください。定型文（お取引条件など）はシステム側で自動付与されるため不要です。

商品名(韓国語): ${product.name_kr}
商品名(日本語): ${product.name_jp}
ブランド: ${product.brand ?? '不明'}
仕入れ元: ${product.source_mall ?? '韓国ショッピングモール'}
販売予定価格: ¥${product.list_price_jpy?.toLocaleString() ?? '未設定'}

以下のJSON形式のみで回答してください（コードブロックなし）:
{
  "title_core": "ブランド名+商品タイプ+特徴 (40字以内, ★などの記号は入れない。例: Matin Kim サイドジップ 2WAY ショルダーバッグ)",
  "intro": "商品の魅力を伝える特徴紹介 3〜5行 (日本語敬語, 各行に絵文字1つ, \\nで改行, 韓国トレンド感を強調)",
  "size_detail": "色・サイズに関する案内文 (日本語敬語, 展開カラーやサイズ選択の案内, 3〜5行, \\nで改行)",
  "buyma_category": "BUYMAカテゴリ(例: レディース > バッグ > ショルダーバッグ)",
  "listing_tags": ["タグ1", "タグ2", "タグ3", "タグ4", "タグ5"]
}`;

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = message.content[0].type === 'text' ? message.content[0].text : '';
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  let parts: ListingAiParts;
  try {
    parts = JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error(`파싱 실패: ${cleaned.slice(0, 200)}`);
    parts = JSON.parse(match[0]);
  }

  // 고정 템플릿 + AI 가변부 조립
  return {
    title_jp: buildTitle(parts.title_core, { brand: product.brand }),
    description_jp: buildProductComment(parts.intro),
    size_comment_jp: buildSizeColorComment(parts.size_detail),
    buyma_category: parts.buyma_category,
    listing_tags: parts.listing_tags,
  };
}

export interface ListingRunResult {
  prepared: number;
  failed: number;
  ran_at: string;
}

export async function runDailyListing(): Promise<ListingRunResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY 미설정');

  const client = new Anthropic({ apiKey });
  const supabase = getAdminSupabase();
  const ranAt = new Date().toISOString();

  // 조건: name_jp, source_url, thumbnail_url 모두 있고, listing_status가 아직 없는 상품
  const { data: products, error } = await supabase
    .from('products')
    .select('id, name_kr, name_jp, brand, source_mall, cost_krw, ship_krw, list_price_jpy, margin_pct, ai_score')
    .not('name_jp', 'is', null)
    .not('source_url', 'is', null)
    .not('thumbnail_url', 'is', null)
    .is('listing_status', null)
    .order('margin_pct', { ascending: false, nullsFirst: false }) // v4: 실측 마진 우선
    .limit(20);

  if (error) throw new Error(`products 조회 실패: ${error.message}`);
  if (!products || products.length === 0) {
    return { prepared: 0, failed: 0, ran_at: ranAt };
  }

  let prepared = 0;
  let failed = 0;
  let blocked = 0;

  // 하드 필터 ② — 등록 준비 단계에서 금지/제한 브랜드 차단 (v4 P0)
  const rules = await loadBrandRules(supabase);

  for (const product of products as ListingProduct[]) {
    const brandCheck = checkBrand(product.brand, rules);
    if (!brandCheck.allowed) {
      blocked++;
      await supabase
        .from('products')
        .update({ status: 'skipped', skip_reason: 'brand_blocked', decided_at: new Date().toISOString() })
        .eq('id', product.id);
      console.log(`[listing-engine] 하드 필터 차단: ${product.brand}/${product.name_kr} — ${brandCheck.matchedRule?.reason}`);
      continue;
    }
    try {
      const listing = await generateListing(client, product);

      const { error: updateError } = await supabase
        .from('products')
        .update({
          title_jp: listing.title_jp,
          description_jp: listing.description_jp,
          size_comment_jp: listing.size_comment_jp,
          buyma_category: listing.buyma_category,
          listing_tags: listing.listing_tags,
          listing_status: 'ready',
        })
        .eq('id', product.id);

      if (updateError) {
        console.error(`[listing-engine] update 실패 ${product.id}:`, updateError);
        failed++;
      } else {
        prepared++;
        // 룰 위반 검사 → 승인 요청 자동 생성 + 사장님 푸시
        await maybeRequestApprovalForListing(
          {
            id: product.id,
            name_kr: product.name_kr,
            name_jp: product.name_jp,
            brand: product.brand,
            buyma_category: listing.buyma_category,
            cost_krw: product.cost_krw,
            list_price_jpy: product.list_price_jpy,
            margin_pct: product.margin_pct,
          },
          null
        ).catch((e) => console.error('[listing-engine] approval-rules 실패:', e));
      }
    } catch (e) {
      console.error(`[listing-engine] ${product.name_kr} 실패:`, e);
      failed++;
    }
  }

  await supabase.from('activity_feed').insert({
    user_id: null,
    actor_label: '등록 엔진',
    action_type: 'daily_listing_run',
    target_type: 'products_batch',
    target_id: null,
    target_label: `등록 자료 생성 ${prepared}개 완료`,
    details: { total: products.length, prepared, failed, blocked, ran_at: ranAt },
  });

  return { prepared, failed, ran_at: ranAt };
}

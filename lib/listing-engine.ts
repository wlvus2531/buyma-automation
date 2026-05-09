/**
 * 등록 엔진 — AI 소싱 완료 상품에 바이마 출품 자료 생성
 * 매일 22:00 UTC (07:00 JST) 자동 실행
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

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
  description_jp: string;
  buyma_category: string;
  listing_tags: string[];
}

async function generateListing(
  client: Anthropic,
  product: ListingProduct
): Promise<ListingData> {
  const prompt = `あなたはBUYMA出品の専門家です。以下の韓国商品情報から最適な出品データを日本語で生成してください。

商品名(韓国語): ${product.name_kr}
商品名(日本語): ${product.name_jp}
ブランド: ${product.brand ?? '不明'}
仕入れ元: ${product.source_mall ?? '韓国ショッピングモール'}
仕入原価: ₩${product.cost_krw.toLocaleString()}
配送費: ₩${product.ship_krw.toLocaleString()}
販売予定価格: ¥${product.list_price_jpy?.toLocaleString() ?? '未設定'}
利益率: ${product.margin_pct ?? 0}%

以下のJSON形式のみで回答してください（コードブロックなし）:
{
  "title_jp": "BUYMAタイトル(60字以内, ★含む, 関税込み/日本未入荷/韓国大人気などのキーワードを含む, ブランド名+商品タイプ+特徴の構造)",
  "description_jp": "商品説明(日本語敬語。商品特徴3〜5行、素材・サイズ案内、ご注文後3〜7営業日以内に発送、関税込み明記、正規品保証。各セクションに絵文字使用。\\nで改行)",
  "buyma_category": "BUYMAカテゴリ(例: レディース > トップス > Tシャツ)",
  "listing_tags": ["タグ1", "タグ2", "タグ3", "タグ4", "タグ5"]
}`;

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = message.content[0].type === 'text' ? message.content[0].text : '';
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  let parsed: ListingData;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error(`파싱 실패: ${cleaned.slice(0, 200)}`);
    parsed = JSON.parse(match[0]);
  }

  return parsed;
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
    .order('ai_score', { ascending: false })
    .limit(20);

  if (error) throw new Error(`products 조회 실패: ${error.message}`);
  if (!products || products.length === 0) {
    return { prepared: 0, failed: 0, ran_at: ranAt };
  }

  let prepared = 0;
  let failed = 0;

  for (const product of products as ListingProduct[]) {
    try {
      const listing = await generateListing(client, product);

      const { error: updateError } = await supabase
        .from('products')
        .update({
          title_jp: listing.title_jp,
          description_jp: listing.description_jp,
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
    details: { total: products.length, prepared, failed, ran_at: ranAt },
  });

  return { prepared, failed, ran_at: ranAt };
}

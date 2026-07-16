/**
 * POST /api/research/report — 확장 수집기가 바이마 실측 데이터 전송
 * body: { mission_id?, method?, items: [{ buyma_item_id, buyma_url, name_jp, brand,
 *         price_jpy, wish_count, access_count, seller_name, rank_position, image_url, raw }] }
 *
 * 처리:
 * - buyma_item_id 기준 upsert (재수집 시 last_seen_at 갱신 + 수치 업데이트)
 * - 썸네일 URL에서 등록일 추출 (V1 기법)
 * - 하드 필터: 금지 브랜드는 저장 시점부터 discarded
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { parseListedDateFromImageUrl } from '@/lib/research-engine';
import { loadBrandRules, checkBrand } from '@/lib/brand-rules';
import { authorizeCollector } from '@/lib/collector-auth';

function getAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

interface ReportItem {
  buyma_item_id: string;
  buyma_url?: string;
  name_jp?: string;
  brand?: string;
  price_jpy?: number;
  wish_count?: number;
  access_count?: number;
  seller_name?: string;
  rank_position?: number;
  image_url?: string;
  raw?: unknown;
}

export async function POST(req: NextRequest) {
  if (!authorizeCollector(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const { mission_id, method, items } = (await req.json()) as {
      mission_id?: string;
      method?: string;
      items: ReportItem[];
    };
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'items 필요' }, { status: 400 });
    }

    const supabase = getAdminSupabase();
    const rules = await loadBrandRules(supabase);
    const now = new Date().toISOString();

    let saved = 0;
    let discarded = 0;

    for (const it of items.slice(0, 100)) {
      if (!it.buyma_item_id) continue;

      const brandCheck = checkBrand(it.brand, rules);
      const listedDate = parseListedDateFromImageUrl(it.image_url);

      const row = {
        buyma_item_id: String(it.buyma_item_id),
        buyma_url: it.buyma_url ?? null,
        name_jp: it.name_jp ?? null,
        brand: it.brand ?? null,
        price_jpy: it.price_jpy ?? null,
        wish_count: it.wish_count ?? null,
        access_count: it.access_count ?? null,
        listed_date: listedDate,
        seller_name: it.seller_name ?? null,
        rank_position: it.rank_position ?? null,
        image_url: it.image_url ?? null,
        mission_id: mission_id ?? null,
        method: method ?? 'A',
        status: brandCheck.allowed ? 'collected' : 'discarded',
        raw: it.raw ?? null,
        last_seen_at: now,
      };

      const { error } = await supabase
        .from('buyma_candidates')
        .upsert(row, { onConflict: 'buyma_item_id', ignoreDuplicates: false });

      if (error) {
        console.error('[research/report] upsert 실패:', error.message);
        continue;
      }
      if (brandCheck.allowed) saved++;
      else discarded++;
    }

    // 미션 수집 카운트 갱신
    if (mission_id) {
      const { data: m } = await supabase
        .from('research_missions')
        .select('items_collected')
        .eq('id', mission_id)
        .single();
      await supabase
        .from('research_missions')
        .update({ items_collected: (m?.items_collected ?? 0) + saved })
        .eq('id', mission_id);
    }

    return NextResponse.json({ ok: true, saved, discarded });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

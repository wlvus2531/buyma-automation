/**
 * GET  /api/listing/autofill
 *   Chrome 확장이 "등록 예정(approved)" 상품 목록 조회
 *   → 자동 입력 패널에 표시할 데이터
 *
 * POST /api/listing/autofill
 *   { id: string }  →  listing_status='listed' 로 마킹 (확장에서 등록 완료 처리)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase';

// ── GET: approved 상품 목록 (자동 입력용 전체 필드 포함)
export async function GET() {
  try {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from('products')
      .select(`
        id,
        name_kr,
        name_jp,
        brand,
        source_mall,
        source_url,
        thumbnail_url,
        cost_krw,
        ship_krw,
        list_price_jpy,
        margin_pct,
        ai_score,
        listing_status,
        title_jp,
        description_jp,
        buyma_category,
        listing_tags,
        listed_at
      `)
      .eq('listing_status', 'approved')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      products: data || [],
      count: (data || []).length,
    });
  } catch (e) {
    console.error('[listing/autofill GET]', e);
    return NextResponse.json({ error: '서버 오류', detail: String(e) }, { status: 500 });
  }
}

// ── POST: 등록 완료 처리 (Chrome 확장에서 호출)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, buyma_listing_url } = body as { id: string; buyma_listing_url?: string };
    if (!id) return NextResponse.json({ error: 'id 필요' }, { status: 400 });

    const supabase = await createServerSupabase();
    const now = new Date().toISOString();

    const updateData: Record<string, unknown> = {
      listing_status: 'listed',
      listed_at: now,
    };
    if (buyma_listing_url) {
      updateData.buyma_listing_url = buyma_listing_url;
    }

    const { error } = await supabase
      .from('products')
      .update(updateData)
      .eq('id', id)
      .eq('listing_status', 'approved'); // 안전장치: approved 상태만 listed로 전환

    if (error) throw error;

    // 활동 피드 기록
    await supabase.from('activity_feed').insert({
      actor_label: 'Chrome 확장',
      action_type: 'listing_completed',
      target_type: 'product',
      target_id: id,
      target_label: '바이마 등록 완료',
      details: { source: 'chrome_extension', buyma_listing_url },
    });

    return NextResponse.json({ ok: true, listed_at: now });
  } catch (e) {
    console.error('[listing/autofill POST]', e);
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}

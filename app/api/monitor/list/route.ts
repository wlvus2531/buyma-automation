/**
 * GET /api/monitor/list
 * 경쟁자 모니터링 데이터 조회
 *
 * Query params:
 *  summary=true  → 오늘 통계 요약 (팝업용)
 *  tab=alerts|all|keyword
 *  keyword=string → 키워드 필터
 *  limit=number
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const summary  = searchParams.get('summary') === 'true';
    const tab      = searchParams.get('tab') || 'all';
    const keyword  = searchParams.get('keyword') || '';
    const limit    = Math.min(parseInt(searchParams.get('limit') || '50'), 200);

    const supabase = await createServerSupabase();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // ── 통계 요약 (팝업 + /today 카운트)
    if (summary) {
      const { count: total } = await supabase
        .from('competitor_prices')
        .select('*', { count: 'exact', head: true })
        .gte('captured_at', todayStart.toISOString());

      const { count: alerts } = await supabase
        .from('competitor_prices')
        .select('*', { count: 'exact', head: true })
        .eq('is_alert', true)
        .gte('captured_at', todayStart.toISOString());

      // 셀러 수 (unique)
      const { data: sellerData } = await supabase
        .from('competitor_prices')
        .select('seller_name')
        .not('seller_name', 'is', null)
        .gte('captured_at', todayStart.toISOString());

      const sellers = new Set((sellerData || []).map(r => r.seller_name)).size;

      // 최근 알림 4건
      const { data: recentAlerts } = await supabase
        .from('competitor_prices')
        .select('id, item_name, alert_reason, price_jpy, captured_at')
        .eq('is_alert', true)
        .order('captured_at', { ascending: false })
        .limit(4);

      return NextResponse.json({
        total: total ?? 0,
        alerts: alerts ?? 0,
        sellers,
        recent_alerts: recentAlerts || [],
      });
    }

    // ── 목록 조회
    let query = supabase
      .from('competitor_prices')
      .select(`
        id, buyma_item_id, buyma_url, item_name, brand,
        seller_name, seller_rating, price_jpy, prev_price_jpy,
        is_in_stock, image_url, rank_position, search_keyword,
        page_type, is_alert, alert_reason, captured_at
      `)
      .order('captured_at', { ascending: false })
      .limit(limit);

    if (tab === 'alerts') {
      query = query.eq('is_alert', true);
    }
    if (keyword) {
      query = query.ilike('search_keyword', `%${keyword}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    // 집계: 오늘 알림 카운트 (for /today badge)
    const { count: todayAlerts } = await supabase
      .from('competitor_prices')
      .select('*', { count: 'exact', head: true })
      .eq('is_alert', true)
      .gte('captured_at', todayStart.toISOString());

    return NextResponse.json({
      items: data || [],
      today_alerts: todayAlerts ?? 0,
    });
  } catch (e) {
    console.error('[monitor/list]', e);
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}

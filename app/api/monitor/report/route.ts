/**
 * POST /api/monitor/report
 * Chrome 확장 → 수집된 BUYMA 경쟁자 가격 데이터 수신
 *
 * 처리 흐름:
 * 1. 유효성 검증
 * 2. buyma_item_id로 최근 캡처 조회 (가격 변동 감지)
 * 3. is_alert 판별: 가격변동 >5%, 재고소진, 우리 가격보다 저렴
 * 4. competitor_prices 테이블 삽입
 * 5. 새 알림 반환 → background.js Chrome 알림 표시
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase';

interface IncomingItem {
  buyma_item_id: string | null;
  buyma_url: string | null;
  item_name: string | null;
  brand: string | null;
  seller_name: string | null;
  seller_rating: number | null;
  price_jpy: number | null;
  is_in_stock: boolean;
  image_url: string | null;
  rank_position: number | null;
  search_keyword: string | null;
  page_type: string;
}

const PRICE_CHANGE_THRESHOLD = 0.05; // 5% 이상 변동 시 알림
const LOW_MARGIN_THRESHOLD_JPY = 500; // 우리 가격과 경쟁사 차이 ¥500 이하 시 알림

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const items: IncomingItem[] = body.items || [];

    if (!items.length) {
      return NextResponse.json({ ok: true, saved: 0, skipped: 0 });
    }

    const supabase = await createServerSupabase();
    const now = new Date().toISOString();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    let saved = 0;
    const newAlerts: Array<{ id: string; item_name: string; alert_reason: string; price_jpy: number | null; message: string }> = [];

    for (const item of items) {
      if (!item.buyma_item_id && !item.buyma_url) continue;

      // 1. 이전 캡처 조회 (가격 변동 감지)
      let prevPrice: number | null = null;
      if (item.buyma_item_id) {
        const { data: prev } = await supabase
          .from('competitor_prices')
          .select('price_jpy')
          .eq('buyma_item_id', item.buyma_item_id)
          .not('price_jpy', 'is', null)
          .order('captured_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        prevPrice = prev?.price_jpy ?? null;
      }

      // 2. 우리 상품과 매칭 (브랜드 + 키워드)
      let productId: string | null = null;
      let ourPrice: number | null = null;
      if (item.search_keyword) {
        const { data: matched } = await supabase
          .from('products')
          .select('id, list_price_jpy')
          .not('list_price_jpy', 'is', null)
          .ilike('name_kr', `%${item.search_keyword.split(' ')[0]}%`)
          .limit(1)
          .maybeSingle();
        if (matched) {
          productId = matched.id;
          ourPrice = matched.list_price_jpy;
        }
      }

      // 3. 알림 판별
      let isAlert = false;
      let alertReason: string | null = null;

      if (item.price_jpy && prevPrice) {
        const change = Math.abs(item.price_jpy - prevPrice) / prevPrice;
        if (change >= PRICE_CHANGE_THRESHOLD) {
          isAlert = true;
          const direction = item.price_jpy < prevPrice ? '↓ 인하' : '↑ 인상';
          alertReason = `가격 ${direction} ${Math.round(change * 100)}% (¥${prevPrice.toLocaleString()} → ¥${item.price_jpy.toLocaleString()})`;
        }
      }

      if (!item.is_in_stock && prevPrice) {
        isAlert = true;
        alertReason = alertReason
          ? alertReason + ' + 품절'
          : '경쟁사 품절 (재입고 기회)';
      }

      if (item.price_jpy && ourPrice && (ourPrice - item.price_jpy) < LOW_MARGIN_THRESHOLD_JPY) {
        isAlert = true;
        const diff = ourPrice - item.price_jpy;
        alertReason = alertReason
          ? alertReason + ` + 가격 경쟁 위험 (차이 ¥${diff})`
          : `가격 경쟁 위험: 경쟁사 ¥${item.price_jpy.toLocaleString()} vs 우리 ¥${ourPrice.toLocaleString()} (차이 ¥${diff})`;
      }

      // 4. 삽입
      const { data: inserted, error } = await supabase
        .from('competitor_prices')
        .insert({
          product_id: productId,
          buyma_item_id: item.buyma_item_id,
          buyma_url: item.buyma_url,
          item_name: item.item_name,
          brand: item.brand,
          seller_name: item.seller_name,
          seller_rating: item.seller_rating,
          price_jpy: item.price_jpy,
          is_in_stock: item.is_in_stock,
          image_url: item.image_url,
          rank_position: item.rank_position,
          search_keyword: item.search_keyword,
          page_type: item.page_type,
          is_alert: isAlert,
          alert_reason: alertReason,
          prev_price_jpy: prevPrice,
          raw_data: item,
          captured_at: now,
        })
        .select('id')
        .single();

      if (!error && inserted) {
        saved++;
        if (isAlert && alertReason) {
          newAlerts.push({
            id: inserted.id,
            item_name: item.item_name || '알 수 없음',
            alert_reason: alertReason,
            price_jpy: item.price_jpy,
            message: `${item.item_name || '상품'}: ${alertReason}`,
          });
        }
      }
    }

    return NextResponse.json({ ok: true, saved, new_alerts: newAlerts });
  } catch (e) {
    console.error('[monitor/report]', e);
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}

// Chrome 확장은 GET으로도 헬스체크
export async function GET() {
  return NextResponse.json({ ok: true, service: 'monitor/report' });
}

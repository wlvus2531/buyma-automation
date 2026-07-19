/**
 * GET  /api/verify/run — Vercel Cron (매일 19:00 UTC = 04:00 JST)
 *   리서치 후보 → 구매처 탐색 → 마진 검증 → products 승격
 * POST /api/verify/run — 수동 트리거 (x-collector-key)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authorizeCron, cronUnauthorized } from '@/lib/cron-auth';
import { authorizeCollector } from '@/lib/collector-auth';
import { runVerification } from '@/lib/verify-engine';

export const maxDuration = 120;

function getAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function handle(limit: number) {
  try {
    const result = await runVerification(getAdminSupabase(), { limit });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error('[verify/run] 오류:', e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  if (!authorizeCron(req)) return cronUnauthorized();
  return handle(15);
}

export async function POST(req: NextRequest) {
  if (!authorizeCollector(req)) return cronUnauthorized();
  const body = await req.json().catch(() => ({}));

  // 승격 상품 근거 새로고침 — 문의수/최근판매(후기)/찜/조회 최신화
  if (body.action === 'refresh_evidence') {
    const supabase = getAdminSupabase();
    const { fetchBuymaHtml, parseItemPage, sleep } = await import('@/lib/buyma-scraper');
    const { data: prods } = await supabase
      .from('products')
      .select('id, evidence')
      .not('candidate_id', 'is', null)
      .not('evidence', 'is', null)
      .limit(body.limit ?? 20);
    let refreshed = 0;
    for (const p of prods ?? []) {
      const ev = (p.evidence ?? {}) as Record<string, unknown>;
      const url = ev.buyma_url as string | undefined;
      if (!url) continue;
      try {
        const d = parseItemPage(await fetchBuymaHtml(url));
        await supabase.from('products').update({
          evidence: {
            ...ev,
            wish_count: d.wish_count ?? ev.wish_count,
            access_count: d.access_count ?? ev.access_count,
            listed_date: d.listed_date ?? ev.listed_date,
            inquiry_count: d.inquiry_count,
            latest_review_date: d.latest_review_date,
            review_count: d.review_count,
          },
        }).eq('id', p.id);
        refreshed++;
        await sleep(1500);
      } catch { /* 개별 실패 무시 */ }
    }
    return NextResponse.json({ ok: true, refreshed });
  }

  // 레거시(AI 환각 소싱) 상품 전체 정리 — 실제 바이마 등록 완료분만 보호
  if (body.action === 'purge_legacy') {
    const supabase = getAdminSupabase();
    const { data: legacy } = await supabase
      .from('products')
      .select('id')
      .is('candidate_id', null)
      .is('listed_at', null)
      .is('buyma_listing_url', null);
    const ids = (legacy ?? []).map((r) => r.id);
    if (body.dry) return NextResponse.json({ ok: true, dry: true, count: ids.length });
    // 1000건 단위 분할 삭제
    for (let i = 0; i < ids.length; i += 500) {
      await supabase.from('products').delete().in('id', ids.slice(i, i + 500));
    }
    return NextResponse.json({ ok: true, removed: ids.length });
  }

  // 비화이트리스트 구매처로 잘못 승격된 상품 정리 → 후보는 재검증 대상으로 복귀
  if (body.action === 'cleanup_untrusted') {
    const supabase = getAdminSupabase();
    const { data: bad } = await supabase
      .from('products')
      .select('id, candidate_id')
      .not('candidate_id', 'is', null)
      .eq('evidence->>source_whitelisted', 'false');
    const ids = (bad ?? []).map((r) => r.id);
    const candIds = (bad ?? []).map((r) => r.candidate_id).filter(Boolean);
    if (ids.length) {
      await supabase.from('products').delete().in('id', ids);
      await supabase.from('buyma_candidates').update({ status: 'enriched' }).in('id', candIds);
    }
    return NextResponse.json({ ok: true, removed: ids.length });
  }

  return handle(body.limit ?? 15);
}

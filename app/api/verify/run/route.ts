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

  // 레거시(AI 환각 소싱) 미결정 상품 정리 — dry:true면 개수만 반환
  if (body.action === 'purge_legacy') {
    const supabase = getAdminSupabase();
    const { data: legacy } = await supabase
      .from('products')
      .select('id')
      .is('candidate_id', null)
      .is('decided_at', null)
      .is('listing_status', null)
      .eq('status', 'sourcing');
    const ids = (legacy ?? []).map((r) => r.id);
    if (body.dry) return NextResponse.json({ ok: true, dry: true, count: ids.length });
    if (ids.length) await supabase.from('products').delete().in('id', ids);
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

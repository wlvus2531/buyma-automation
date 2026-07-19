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
  return handle(body.limit ?? 15);
}

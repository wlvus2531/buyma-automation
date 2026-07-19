/**
 * GET /api/research/run — Vercel Cron (매일 18:30 UTC = 03:30 JST, 소싱 전)
 * 미션 생성 → 서버 수집(전체) → 찜/조회수 보강
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authorizeCron, cronUnauthorized } from '@/lib/cron-auth';
import { generateDailyMissions, runResearchCollection, runEnrichment } from '@/lib/research-engine';

export const maxDuration = 120;

export async function GET(req: NextRequest) {
  if (!authorizeCron(req)) return cronUnauthorized();
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const gen = await generateDailyMissions(supabase);
    const collect = await runResearchCollection(supabase, { missionLimit: 6 });
    const enrich = await runEnrichment(supabase, { limit: 24 });
    return NextResponse.json({ ok: true, generated: gen.created, ...collect, enrich });
  } catch (e) {
    console.error('[research/run] 오류:', e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

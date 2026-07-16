/**
 * GET  /api/research/missions — 오늘의 미션 목록 (확장 수집기가 가져감)
 * POST /api/research/missions — { action: 'generate' } 미션 생성 (cron/수동)
 *                               { action: 'update', id, status, items_collected? } 미션 상태 갱신 (확장)
 *
 * 확장 인증: x-collector-key 헤더 = CRON_SECRET 또는 COLLECTOR_KEY
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateDailyMissions } from '@/lib/research-engine';
import { authorizeCollector } from '@/lib/collector-auth';

function getAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(req: NextRequest) {
  if (!authorizeCollector(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const supabase = getAdminSupabase();
  const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from('research_missions')
    .select('id, method, label, entry_url, status, priority, items_collected')
    .eq('mission_date', today)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ date: today, missions: data ?? [] });
}

export async function POST(req: NextRequest) {
  if (!authorizeCollector(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const body = await req.json();
    const supabase = getAdminSupabase();

    if (body.action === 'generate') {
      const result = await generateDailyMissions(supabase);
      return NextResponse.json({ ok: true, ...result });
    }

    if (body.action === 'update') {
      const { id, status, items_collected } = body;
      if (!id || !status) return NextResponse.json({ error: 'id, status 필요' }, { status: 400 });
      const update: Record<string, unknown> = { status };
      if (typeof items_collected === 'number') update.items_collected = items_collected;
      if (status === 'done' || status === 'failed') update.completed_at = new Date().toISOString();
      const { error } = await supabase.from('research_missions').update(update).eq('id', id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

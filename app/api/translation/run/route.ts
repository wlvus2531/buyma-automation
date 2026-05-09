/**
 * GET  /api/translation/run  — Vercel Cron (매일 21:00 UTC = 06:00 JST)
 * POST /api/translation/run  — 수동 트리거
 */

import { NextRequest, NextResponse } from 'next/server';
import { runDailyTranslation } from '@/lib/translation-engine';

export const maxDuration = 120;

function authorize(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = req.headers.get('authorization');
  return auth === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: '인증 실패' }, { status: 401 });
  }

  try {
    const result = await runDailyTranslation();
    return NextResponse.json({
      ok: true,
      translated: result.translated,
      failed: result.failed,
      ran_at: result.ran_at,
    });
  } catch (e) {
    console.error('[translation/run] 오류:', e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : '번역 실패' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}

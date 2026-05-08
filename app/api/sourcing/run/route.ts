/**
 * GET  /api/sourcing/run  — Vercel Cron (매일 19:00 UTC = 04:00 JST)
 * POST /api/sourcing/run  — 수동 트리거 (테스트용)
 *
 * 인증: Authorization: Bearer {CRON_SECRET}
 */

import { NextRequest, NextResponse } from 'next/server';
import { runDailySourcing } from '@/lib/sourcing-engine';

export const maxDuration = 120; // 2분 — Claude 3배치 순차 호출 대응

function authorize(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // 미설정 시 개발환경으로 간주

  const auth = req.headers.get('authorization');
  return auth === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: '인증 실패' }, { status: 401 });
  }

  try {
    const result = await runDailySourcing();
    return NextResponse.json({
      ok: true,
      saved: result.saved,
      skipped: result.skipped,
      total: result.candidates.length,
      ran_at: result.ran_at,
    });
  } catch (e) {
    console.error('[sourcing/run] 오류:', e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : '소싱 실패' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}

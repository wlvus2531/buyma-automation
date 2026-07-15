/**
 * GET  /api/sourcing/run  — Vercel Cron (매일 19:00 UTC = 04:00 JST)
 * POST /api/sourcing/run  — 수동 트리거 (앱 내 버튼)
 *
 * 인증: GET은 Authorization: Bearer {CRON_SECRET} 필수 (프로덕션)
 */

import { NextRequest, NextResponse } from 'next/server';
import { authorizeCron, cronUnauthorized } from '@/lib/cron-auth';
import { runDailySourcing } from '@/lib/sourcing-engine';

export const maxDuration = 120; // 2분 — Claude 3배치 순차 호출 대응

async function handleRun() {
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

export async function GET(req: NextRequest) {
  if (!authorizeCron(req)) return cronUnauthorized();
  return handleRun();
}

// POST = UI 수동 트리거. 앱 레벨 인증 도입 전까지 개방 — cron(GET)만 시크릿 강제
export async function POST() {
  return handleRun();
}

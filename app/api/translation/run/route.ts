/**
 * GET  /api/translation/run  — Vercel Cron (매일 21:00 UTC = 06:00 JST)
 * POST /api/translation/run  — 수동 트리거 (앱 내 버튼)
 *
 * 인증: GET은 Authorization: Bearer {CRON_SECRET} 필수 (프로덕션)
 */

import { NextRequest, NextResponse } from 'next/server';
import { authorizeCron, cronUnauthorized } from '@/lib/cron-auth';
import { runDailyTranslation } from '@/lib/translation-engine';

export const maxDuration = 120;

async function handleRun() {
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

export async function GET(req: NextRequest) {
  if (!authorizeCron(req)) return cronUnauthorized();
  return handleRun();
}

// POST = UI 수동 트리거. 앱 레벨 인증 도입 전까지 개방 — cron(GET)만 시크릿 강제
export async function POST() {
  return handleRun();
}

/**
 * GET  /api/scraper/run  — Vercel Cron (매일 20:00 UTC = 05:00 JST)
 * POST /api/scraper/run  — 수동 트리거 (앱 내 버튼)
 *
 * 인증: GET은 Authorization: Bearer {CRON_SECRET} 필수 (프로덕션)
 */

import { NextRequest, NextResponse } from 'next/server';
import { authorizeCron, cronUnauthorized } from '@/lib/cron-auth';
import { runDailyScraper, ScraperMode } from '@/lib/scraper-engine';

export const maxDuration = 120;

function parseMode(req: NextRequest): ScraperMode {
  const url = new URL(req.url);
  const m = url.searchParams.get('mode');
  return m === 'thumbnails' ? 'thumbnails' : 'new';
}

async function handleRun(req: NextRequest) {
  try {
    const mode = parseMode(req);
    const result = await runDailyScraper(mode);
    return NextResponse.json({
      ok: true,
      mode,
      updated: result.updated,
      failed: result.failed,
      skipped: result.skipped,
      ran_at: result.ran_at,
    });
  } catch (e) {
    console.error('[scraper/run] 오류:', e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : '스크래퍼 실패' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  if (!authorizeCron(req)) return cronUnauthorized();
  return handleRun(req);
}

// POST = UI 수동 트리거. 앱 레벨 인증 도입 전까지 개방 — cron(GET)만 시크릿 강제
export async function POST(req: NextRequest) {
  return handleRun(req);
}

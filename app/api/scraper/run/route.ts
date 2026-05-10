/**
 * GET  /api/scraper/run  — Vercel Cron (매일 20:00 UTC = 05:00 JST)
 * POST /api/scraper/run  — 수동 트리거
 *
 * 인증: Authorization: Bearer {CRON_SECRET}
 */

import { NextRequest, NextResponse } from 'next/server';
import { runDailyScraper, ScraperMode } from '@/lib/scraper-engine';

export const maxDuration = 120;

function authorize(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = req.headers.get('authorization');
  return auth === `Bearer ${secret}`;
}

function parseMode(req: NextRequest): ScraperMode {
  const url = new URL(req.url);
  const m = url.searchParams.get('mode');
  return m === 'thumbnails' ? 'thumbnails' : 'new';
}

export async function GET(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: '인증 실패' }, { status: 401 });
  }

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

export async function POST(req: NextRequest) {
  return GET(req);
}

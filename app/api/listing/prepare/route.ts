import { NextResponse } from 'next/server';
import { runDailyListing } from '@/lib/listing-engine';

export const maxDuration = 120;

export async function GET() {
  try {
    const result = await runDailyListing();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error('[listing/prepare] GET 오류:', e);
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : '실행 실패' }, { status: 500 });
  }
}

export async function POST() {
  try {
    const result = await runDailyListing();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error('[listing/prepare] POST 오류:', e);
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : '실행 실패' }, { status: 500 });
  }
}

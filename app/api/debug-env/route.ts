// 임시 진단용 — CRON_SECRET 인식 여부 확인 후 즉시 삭제 예정
import { NextResponse } from 'next/server';

export async function GET() {
  const s = process.env.CRON_SECRET ?? '';
  return NextResponse.json({
    hasSecret: !!s,
    length: s.length,
    prefix: s.slice(0, 4),
    vercelEnv: process.env.VERCEL_ENV ?? null,
  });
}

// redeploy marker: 1784157451
// redeploy marker 2: 1784187085

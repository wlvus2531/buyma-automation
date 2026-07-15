/**
 * Cron 엔드포인트 공통 인증 — v4 P0
 *
 * 정책 (fail-closed):
 * - 프로덕션(VERCEL_ENV=production)에서 CRON_SECRET 미설정 → 무조건 거부
 * - CRON_SECRET 설정 시 Authorization: Bearer {CRON_SECRET} 필수
 * - 로컬 개발(VERCEL_ENV 없음)에서만 시크릿 미설정 허용
 */

import { NextRequest, NextResponse } from 'next/server';

export function authorizeCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Vercel 배포 환경에서 시크릿 미설정이면 잠금 (v3.1은 여기서 열려 있었음)
    return !process.env.VERCEL_ENV;
  }
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

export function cronUnauthorized(): NextResponse {
  return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
}

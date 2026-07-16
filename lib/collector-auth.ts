/**
 * Chrome 확장 수집기 인증 — x-collector-key 헤더
 * CRON_SECRET 또는 COLLECTOR_KEY와 일치해야 함 (프로덕션 fail-closed)
 */
import { NextRequest } from 'next/server';

export function authorizeCollector(req: NextRequest): boolean {
  const key = req.headers.get('x-collector-key') ?? '';
  const valid = [process.env.CRON_SECRET, process.env.COLLECTOR_KEY].filter(Boolean);
  if (valid.length === 0) return !process.env.VERCEL_ENV; // 로컬 개발만 허용
  return valid.includes(key);
}

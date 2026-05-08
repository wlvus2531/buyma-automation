/**
 * Supabase 클라이언트
 * - 브라우저: createClient (실시간 구독 + 인증)
 * - 서버: createServerClient (RSC, API 라우트)
 */

import { createBrowserClient, createServerClient } from '@supabase/ssr';

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    '⚠️  Supabase 환경변수가 설정되지 않았습니다. .env.local 확인 필요.'
  );
}

/** 브라우저 컴포넌트에서 사용 */
export function createBrowserSupabase() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

/** 서버 컴포넌트 / API 라우트에서 사용 */
export async function createServerSupabase() {
  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options as Parameters<typeof cookieStore.set>[2])
          );
        } catch {
          // Server Component에서는 무시 (middleware에서 갱신)
        }
      },
    },
  });
}

/** 현재 운영자 ID 가져오기 (간단 버전 — 운영 시 auth와 연동) */
export async function getCurrentUserId(): Promise<string | null> {
  // 실제 운영 시: Supabase auth.getUser()로 인증된 사용자 가져오기
  // 데모용 임시: localStorage에 저장된 user_id 사용
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('current_user_id');
}

/**
 * POST /api/push/subscribe — 사장님 PWA 푸시 구독 등록
 * DELETE /api/push/subscribe — 구독 해제
 *
 * Body: { subscription: PushSubscriptionJSON, userId: string }
 *
 * users 테이블에 push_endpoint, push_keys 저장
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

export async function POST(req: NextRequest) {
  try {
    const { subscription, userId } = await req.json();
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return NextResponse.json({ ok: false, error: 'subscription 형식 오류' }, { status: 400 });
    }
    if (!userId) {
      return NextResponse.json({ ok: false, error: 'userId 필수' }, { status: 400 });
    }

    const supabase = getAdminSupabase();
    const { error } = await supabase
      .from('users')
      .update({
        push_endpoint: subscription.endpoint,
        push_keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
      })
      .eq('id', userId);

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : '오류' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { userId } = await req.json();
    if (!userId) return NextResponse.json({ ok: false, error: 'userId 필수' }, { status: 400 });

    const supabase = getAdminSupabase();
    const { error } = await supabase
      .from('users')
      .update({ push_endpoint: null, push_keys: null })
      .eq('id', userId);

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : '오류' }, { status: 500 });
  }
}

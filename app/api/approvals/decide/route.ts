/**
 * POST /api/approvals/decide — 사장님 모바일에서 승인/거부 처리
 * Body: { approval_id, action: 'approve' | 'reject', userId?, decision_note?, decided_value? }
 *
 * Service Worker의 알림 action 버튼에서도 호출됨 (백그라운드).
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
    const body = await req.json();
    const { approval_id, action, userId, decision_note, decided_value } = body;
    if (!approval_id || !action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ ok: false, error: 'approval_id, action 필수' }, { status: 400 });
    }

    const supabase = getAdminSupabase();
    const status = action === 'approve' ? 'approved' : 'rejected';

    // 사장님 식별 — userId 없으면 첫 번째 owner
    let deciderId = userId;
    if (!deciderId) {
      const { data: owner } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'owner')
        .limit(1)
        .maybeSingle();
      deciderId = owner?.id;
    }

    const { data: approval, error } = await supabase
      .from('approvals')
      .update({
        status,
        decided_by: deciderId,
        decided_at: new Date().toISOString(),
        decision_note: decision_note ?? null,
        decided_value: decided_value ?? null,
      })
      .eq('id', approval_id)
      .select('*, requester:users!approvals_requested_by_fkey(name)')
      .maybeSingle();

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    // 활동 피드 기록
    await supabase.from('activity_feed').insert({
      user_id: deciderId,
      actor_label: '사장님',
      action_type: action === 'approve' ? 'approval_approve' : 'approval_reject',
      target_type: 'approval',
      target_id: approval_id,
      target_label: approval?.target_label ?? '승인 결정',
      details: { decision_note, decided_value },
    });

    return NextResponse.json({ ok: true, status });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : '오류' }, { status: 500 });
  }
}

/**
 * POST /api/cs/action
 * { id, action: 'replied' | 'escalated', final_reply? }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const { id, action, final_reply } = await req.json() as {
      id: string;
      action: 'replied' | 'escalated';
      final_reply?: string;
    };
    if (!id || !action) return NextResponse.json({ error: 'id, action 필요' }, { status: 400 });

    const supabase = await createServerSupabase();
    const now = new Date().toISOString();

    const updates: Record<string, unknown> = { status: action };
    if (action === 'replied') {
      updates.replied_at = now;
      if (final_reply) updates.final_reply = final_reply;
    }

    const { error } = await supabase
      .from('cs_threads')
      .update(updates)
      .eq('id', id);

    if (error) throw error;

    // 활동 피드 기록
    await supabase.from('activity_feed').insert({
      actor_label: '운영자',
      action_type: `cs_${action}`,
      target_type: 'cs_thread',
      target_id: id,
      target_label: action === 'replied' ? 'CS 답변 완료' : 'CS 에스컬레이션',
      details: {},
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[cs/action]', e);
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}

/**
 * POST /api/cs/reply
 * { id: string } → Claude Haiku로 AI 답변 초안 생성
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase';
import { generateCSReply } from '@/lib/cs-engine';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { id, context } = await req.json() as {
      id: string;
      context?: { orderStatus?: string; trackingNumber?: string; productName?: string };
    };
    if (!id) return NextResponse.json({ error: 'id 필요' }, { status: 400 });

    const supabase = await createServerSupabase();

    const { data: thread, error: fetchErr } = await supabase
      .from('cs_threads')
      .select('id, customer_message, status')
      .eq('id', id)
      .single();

    if (fetchErr || !thread) {
      return NextResponse.json({ error: '스레드를 찾을 수 없습니다' }, { status: 404 });
    }

    // 생성 중 상태로 마킹
    await supabase.from('cs_threads').update({ status: 'generating' }).eq('id', id);

    const result = await generateCSReply(thread.customer_message, context);

    await supabase
      .from('cs_threads')
      .update({
        ai_reply: result.reply,
        category: result.category,
        notes: result.summary_kr,
        status: 'pending',
      })
      .eq('id', id);

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error('[cs/reply]', e);
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}

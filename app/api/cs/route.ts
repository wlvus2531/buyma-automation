/**
 * GET  /api/cs         — CS 스레드 목록
 * POST /api/cs         — 새 CS 스레드 생성
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const status   = searchParams.get('status') || '';
    const category = searchParams.get('category') || '';
    const limit    = Math.min(parseInt(searchParams.get('limit') || '50'), 200);

    const supabase = await createServerSupabase();
    let query = supabase
      .from('cs_threads')
      .select('id, order_id, customer_name, customer_message, ai_reply, final_reply, status, category, notes, created_at, replied_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status)   query = query.eq('status', status);
    if (category) query = query.eq('category', category);

    const { data, error } = await query;
    if (error) throw error;

    // 미답변 카운트
    const { count: pending } = await supabase
      .from('cs_threads')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    return NextResponse.json({ threads: data || [], pending: pending ?? 0 });
  } catch (e) {
    console.error('[cs GET]', e);
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { customer_message, customer_name, order_id, notes } = body as {
      customer_message: string;
      customer_name?: string;
      order_id?: string;
      notes?: string;
    };

    if (!customer_message?.trim()) {
      return NextResponse.json({ error: '고객 문의 내용이 없습니다' }, { status: 400 });
    }

    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from('cs_threads')
      .insert({
        customer_message: customer_message.trim(),
        customer_name: customer_name?.trim() || null,
        order_id: order_id?.trim() || null,
        notes: notes?.trim() || null,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ ok: true, thread: data });
  } catch (e) {
    console.error('[cs POST]', e);
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}

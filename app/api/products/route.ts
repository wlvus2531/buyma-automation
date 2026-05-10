import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

export async function GET() {
  const supabase = getAdminSupabase();
  const { data, error } = await supabase
    .from('products')
    .select('id, name_kr, name_jp, brand, source_mall, cost_krw, ship_krw, list_price_jpy, margin_pct, ai_score, status, listing_status, skip_reason, decided_at, source_url, thumbnail_url, created_at')
    .order('ai_score', { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ products: data ?? [] });
}

// 선택(select) / 패스(skip) / 복구(restore, restore_select) 액션
export async function PATCH(req: NextRequest) {
  try {
    const { id, action, reason } = await req.json() as {
      id: string;
      action: 'select' | 'skip' | 'restore' | 'restore_select';
      reason?: string;
    };
    if (!id || !action) return NextResponse.json({ error: 'id, action 필요' }, { status: 400 });

    const supabase = getAdminSupabase();
    const now = new Date().toISOString();
    let update: Record<string, unknown> = {};

    if (action === 'select') {
      update = { listing_status: 'pending', decided_at: now };
    } else if (action === 'skip') {
      update = { status: 'skipped', skip_reason: reason ?? null, decided_at: now };
    } else if (action === 'restore') {
      update = { status: 'active', skip_reason: null, decided_at: null };
    } else if (action === 'restore_select') {
      update = { listing_status: null, decided_at: null };
    } else {
      return NextResponse.json({ error: 'unknown action' }, { status: 400 });
    }

    const { error } = await supabase.from('products').update(update).eq('id', id);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

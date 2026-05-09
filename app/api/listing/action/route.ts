import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

type ListingAction = 'approve' | 'reject' | 'listed';

const ACTION_STATUS: Record<ListingAction, string> = {
  approve: 'approved',
  reject: 'rejected',
  listed: 'listed',
};

export async function POST(req: NextRequest) {
  try {
    const { id, action }: { id: string; action: ListingAction } = await req.json();
    if (!id || !action || !(action in ACTION_STATUS)) {
      return NextResponse.json({ ok: false, error: 'id, action 필수 (approve|reject|listed)' }, { status: 400 });
    }

    const supabase = getAdminSupabase();
    const updates: Record<string, unknown> = { listing_status: ACTION_STATUS[action] };
    if (action === 'listed') updates.listed_at = new Date().toISOString();

    const { error } = await supabase
      .from('products')
      .update(updates)
      .eq('id', id);

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    await supabase.from('activity_feed').insert({
      user_id: null,
      actor_label: '사장님',
      action_type: `listing_${action}`,
      target_type: 'product',
      target_id: id,
      target_label: `상품 ${ACTION_STATUS[action]}`,
      details: { action, product_id: id },
    });

    return NextResponse.json({ ok: true, status: ACTION_STATUS[action] });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : '처리 실패' }, { status: 500 });
  }
}

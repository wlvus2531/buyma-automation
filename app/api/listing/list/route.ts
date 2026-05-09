import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tab = searchParams.get('tab') ?? 'ready';

  const supabase = getAdminSupabase();

  let query = supabase
    .from('products')
    .select('id, name_kr, name_jp, brand, source_mall, cost_krw, ship_krw, list_price_jpy, margin_pct, ai_score, thumbnail_url, source_url, listing_status, title_jp, description_jp, buyma_category, listing_tags, listed_at, created_at')
    .order('ai_score', { ascending: false })
    .limit(50);

  if (tab === 'ready') {
    query = query.eq('listing_status', 'ready');
  } else if (tab === 'approved') {
    query = query.eq('listing_status', 'approved');
  } else if (tab === 'listed') {
    query = query.eq('listing_status', 'listed');
  } else if (tab === 'rejected') {
    query = query.eq('listing_status', 'rejected');
  } else {
    query = query.in('listing_status', ['ready', 'approved', 'listed', 'rejected']);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ products: data ?? [] });
}

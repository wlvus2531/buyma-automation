import { NextResponse } from 'next/server';
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
    .select('id, name_kr, name_jp, brand, source_mall, cost_krw, ship_krw, list_price_jpy, margin_pct, ai_score, status, source_url, thumbnail_url, created_at')
    .order('ai_score', { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ products: data ?? [] });
}

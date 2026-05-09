/**
 * GET /api/setup?token=setup2026
 * Week 6 + Week 8 DB 마이그레이션 실행 (1회용 엔드포인트)
 *
 * Supabase service_role key로 /rest/v1/rpc 또는 Management API 사용
 */

import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PROJECT_REF   = (SUPABASE_URL || '').match(/https?:\/\/([^.]+)\./)?.[1] || '';

const SQL_WEEK6 = `
CREATE TABLE IF NOT EXISTS competitor_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  buyma_item_id text, buyma_url text, item_name text, brand text,
  seller_name text, seller_rating integer, price_jpy integer,
  is_in_stock boolean DEFAULT true, image_url text,
  rank_position integer, search_keyword text, page_type text,
  is_alert boolean DEFAULT false, alert_reason text,
  prev_price_jpy integer, raw_data jsonb,
  captured_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cp_captured_at    ON competitor_prices(captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_cp_buyma_item_id  ON competitor_prices(buyma_item_id);
CREATE INDEX IF NOT EXISTS idx_cp_is_alert       ON competitor_prices(is_alert) WHERE is_alert = true;
CREATE INDEX IF NOT EXISTS idx_cp_search_keyword ON competitor_prices(search_keyword);
CREATE INDEX IF NOT EXISTS idx_cp_product_id     ON competitor_prices(product_id);
ALTER TABLE competitor_prices ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='competitor_prices' AND policyname='cp_service_all') THEN
    CREATE POLICY "cp_service_all" ON competitor_prices FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='competitor_prices' AND policyname='cp_anon_select') THEN
    CREATE POLICY "cp_anon_select" ON competitor_prices FOR SELECT TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='competitor_prices' AND policyname='cp_anon_insert') THEN
    CREATE POLICY "cp_anon_insert" ON competitor_prices FOR INSERT TO anon WITH CHECK (true);
  END IF;
END $$;
CREATE OR REPLACE VIEW competitor_alerts_today AS
SELECT cp.id, cp.buyma_item_id, cp.item_name, cp.seller_name,
  cp.price_jpy, cp.prev_price_jpy,
  (cp.price_jpy - cp.prev_price_jpy) AS price_change_jpy,
  cp.is_in_stock, cp.alert_reason, cp.search_keyword,
  cp.rank_position, cp.captured_at,
  p.name_kr, p.list_price_jpy AS our_price_jpy,
  (p.list_price_jpy - cp.price_jpy) AS vs_our_price_jpy
FROM competitor_prices cp
LEFT JOIN products p ON p.id = cp.product_id
WHERE cp.is_alert = true AND cp.captured_at > now() - interval '24 hours'
ORDER BY cp.captured_at DESC;
`;

const SQL_WEEK8 = `
CREATE TABLE IF NOT EXISTS cs_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id text, customer_name text,
  customer_message text NOT NULL,
  ai_reply text, final_reply text,
  status text DEFAULT 'pending' CHECK (status IN ('pending','generating','replied','escalated')),
  category text DEFAULT '기타' CHECK (category IN ('배송','환불','상품문의','기타')),
  language text DEFAULT 'ja', notes text,
  created_at timestamptz DEFAULT now(),
  replied_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_cs_status     ON cs_threads(status);
CREATE INDEX IF NOT EXISTS idx_cs_created_at ON cs_threads(created_at DESC);
ALTER TABLE cs_threads ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cs_threads' AND policyname='cs_service_all') THEN
    CREATE POLICY "cs_service_all" ON cs_threads FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cs_threads' AND policyname='cs_anon_select') THEN
    CREATE POLICY "cs_anon_select" ON cs_threads FOR SELECT TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cs_threads' AND policyname='cs_anon_insert') THEN
    CREATE POLICY "cs_anon_insert" ON cs_threads FOR INSERT TO anon WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cs_threads' AND policyname='cs_anon_update') THEN
    CREATE POLICY "cs_anon_update" ON cs_threads FOR UPDATE TO anon USING (true);
  END IF;
END $$;
`;

async function runSQL(sql: string): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  // 방법 1: Supabase /rest/v1/sql (PostgREST 12+ 방식)
  try {
    const r1 = await fetch(`${SUPABASE_URL}/rest/v1/sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'apikey': SERVICE_KEY,
      },
      body: JSON.stringify({ query: sql }),
    });
    if (r1.ok) {
      const d = await r1.json();
      return { ok: true, data: d };
    }
    const e1 = await r1.text();

    // 방법 2: Supabase Management API
    const r2 = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({ query: sql }),
    });
    if (r2.ok) {
      const d = await r2.json();
      return { ok: true, data: d };
    }
    const e2 = await r2.text();

    return { ok: false, error: `rest/v1/sql: ${e1.slice(0, 200)} | mgmt: ${e2.slice(0, 200)}` };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (token !== 'setup2026') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return NextResponse.json({
      error: 'SUPABASE 환경변수 없음',
      SUPABASE_URL: !!SUPABASE_URL,
      SERVICE_KEY: !!SERVICE_KEY,
    }, { status: 500 });
  }

  const [r6, r8] = await Promise.all([
    runSQL(SQL_WEEK6),
    runSQL(SQL_WEEK8),
  ]);

  return NextResponse.json({
    ok: r6.ok && r8.ok,
    project_ref: PROJECT_REF,
    week6: r6,
    week8: r8,
  });
}

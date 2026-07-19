-- ============================================================
-- v4 P2 — 검증 파이프라인: 구매처 후보 + 근거 연결
-- Supabase SQL Editor에서 실행 (멱등)
-- ============================================================

-- 상품별 구매처 후보 (검증된 실가격)
CREATE TABLE IF NOT EXISTS purchase_sources (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id   uuid REFERENCES buyma_candidates(id) ON DELETE CASCADE,
  product_id     uuid,
  mall           text,
  url            text,
  title          text,
  price_krw      integer,
  is_whitelisted boolean DEFAULT false,
  rank           integer DEFAULT 0,     -- 0 = 최우선 (화이트리스트 + 최저가)
  checked_at     timestamptz DEFAULT now(),
  created_at     timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_psources_candidate ON purchase_sources(candidate_id);
CREATE INDEX IF NOT EXISTS idx_psources_product ON purchase_sources(product_id);

-- products에 근거 연결 (v4 실측 소싱)
ALTER TABLE products ADD COLUMN IF NOT EXISTS candidate_id uuid;
ALTER TABLE products ADD COLUMN IF NOT EXISTS evidence jsonb;
CREATE INDEX IF NOT EXISTS idx_products_candidate ON products(candidate_id);

-- RLS: service role 전용
ALTER TABLE purchase_sources ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='purchase_sources' AND policyname='ps_service_all') THEN
    CREATE POLICY "ps_service_all" ON purchase_sources FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 확인
SELECT column_name FROM information_schema.columns
WHERE table_name='products' AND column_name IN ('candidate_id','evidence')
UNION ALL
SELECT table_name FROM information_schema.tables WHERE table_name='purchase_sources';

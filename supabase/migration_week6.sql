-- ============================================================
-- Week 6: 경쟁자 가격 모니터링 테이블
-- Chrome 확장에서 수집한 BUYMA 경쟁자 가격 데이터 저장
-- ============================================================

CREATE TABLE IF NOT EXISTS competitor_prices (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id       uuid REFERENCES products(id) ON DELETE SET NULL,
  buyma_item_id    text,
  buyma_url        text,
  item_name        text,
  brand            text,
  seller_name      text,
  seller_rating    integer,
  price_jpy        integer,
  is_in_stock      boolean DEFAULT true,
  image_url        text,
  rank_position    integer,
  search_keyword   text,
  page_type        text,          -- 'item' | 'search' | 'brand'
  is_alert         boolean DEFAULT false,
  alert_reason     text,
  prev_price_jpy   integer,       -- 이전 캡처 가격 (변동 감지용)
  raw_data         jsonb,
  captured_at      timestamptz DEFAULT now(),
  created_at       timestamptz DEFAULT now()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_cp_captured_at      ON competitor_prices(captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_cp_buyma_item_id    ON competitor_prices(buyma_item_id);
CREATE INDEX IF NOT EXISTS idx_cp_is_alert         ON competitor_prices(is_alert) WHERE is_alert = true;
CREATE INDEX IF NOT EXISTS idx_cp_search_keyword   ON competitor_prices(search_keyword);
CREATE INDEX IF NOT EXISTS idx_cp_product_id       ON competitor_prices(product_id);

-- RLS
ALTER TABLE competitor_prices ENABLE ROW LEVEL SECURITY;

-- 서비스 롤: 전체 권한 (API 라우트)
CREATE POLICY "cp_service_all" ON competitor_prices
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- anon (Chrome 확장): 읽기 + 삽입
CREATE POLICY "cp_anon_select" ON competitor_prices
  FOR SELECT TO anon USING (true);

CREATE POLICY "cp_anon_insert" ON competitor_prices
  FOR INSERT TO anon WITH CHECK (true);

-- ============================================================
-- 요약 뷰: 오늘 알림 목록
-- ============================================================
CREATE OR REPLACE VIEW competitor_alerts_today AS
SELECT
  cp.id,
  cp.buyma_item_id,
  cp.item_name,
  cp.seller_name,
  cp.price_jpy,
  cp.prev_price_jpy,
  (cp.price_jpy - cp.prev_price_jpy) AS price_change_jpy,
  cp.is_in_stock,
  cp.alert_reason,
  cp.search_keyword,
  cp.rank_position,
  cp.captured_at,
  p.name_kr,
  p.list_price_jpy AS our_price_jpy,
  (p.list_price_jpy - cp.price_jpy) AS vs_our_price_jpy
FROM competitor_prices cp
LEFT JOIN products p ON p.id = cp.product_id
WHERE cp.is_alert = true
  AND cp.captured_at > now() - interval '24 hours'
ORDER BY cp.captured_at DESC;

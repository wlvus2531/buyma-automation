-- ============================================================
-- 통합 마이그레이션 — products 테이블에 누락된 컬럼 추가
-- Week 5 (등록 워크플로우) + Week 7 (Chrome 자동입력)
-- ============================================================

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS listing_status     text     DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS title_jp           text     DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS description_jp     text     DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS buyma_category     text     DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS listing_tags       text[]   DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS listed_at          timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS buyma_listing_url  text     DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_products_listing_status ON products(listing_status);

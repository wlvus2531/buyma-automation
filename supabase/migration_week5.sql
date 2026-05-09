-- Week 5: 등록 워크플로우 컬럼 추가
-- Supabase 대시보드 > SQL Editor에서 실행하세요

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS listing_status text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS title_jp        text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS description_jp  text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS buyma_category  text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS listing_tags    text[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS listed_at       timestamptz DEFAULT NULL;

-- listing_status 인덱스 (등록 대기 조회 성능)
CREATE INDEX IF NOT EXISTS idx_products_listing_status ON products(listing_status);

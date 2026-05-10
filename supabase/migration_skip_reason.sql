-- 패스 사유 + 결정 시각 컬럼 추가
-- 사용처: /products 선택/패스 UX, AI 소싱 피드백 루프, 오늘 진행률 위젯

ALTER TABLE products ADD COLUMN IF NOT EXISTS skip_reason TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS decided_at TIMESTAMPTZ;

-- "오늘 결정한 N개" 쿼리
CREATE INDEX IF NOT EXISTS idx_products_decided_at
  ON products(decided_at DESC);

-- 피드백 루프 집계 (skip_reason NOT NULL 만)
CREATE INDEX IF NOT EXISTS idx_products_skip_reason
  ON products(skip_reason) WHERE skip_reason IS NOT NULL;

-- 확인
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'products'
  AND column_name IN ('skip_reason', 'decided_at');

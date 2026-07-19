-- ============================================================
-- v4 P4 — 업로드 준비: 색·사이즈 보충문 + 썸네일 제작 컬럼
-- Supabase SQL Editor에서 실행 (멱등)
-- ============================================================

ALTER TABLE products ADD COLUMN IF NOT EXISTS size_comment_jp TEXT; -- 색·사이즈 보충 (일본어)
ALTER TABLE products ADD COLUMN IF NOT EXISTS thumbnail_made_url TEXT; -- 직접 제작한 썸네일 (data URL 또는 저장 경로)

-- 확인
SELECT column_name FROM information_schema.columns
WHERE table_name='products' AND column_name IN ('size_comment_jp','thumbnail_made_url');

-- ============================================================
-- v4 P1 — 리서치 수집기: 미션 + 바이마 실측 후보
-- Supabase SQL Editor에서 실행 (멱등)
-- ============================================================

-- 오늘의 리서치 미션 (서버 생성 → Chrome 확장이 수행)
CREATE TABLE IF NOT EXISTS research_missions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_date     date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Seoul')::date,
  method           text NOT NULL DEFAULT 'A',   -- A 인기상품 | B 모델링 | C 파생
  label            text NOT NULL,               -- 예: "레디스 모자 · 인기순 · 한국발"
  entry_url        text NOT NULL,               -- 확장이 방문할 바이마 URL
  status           text NOT NULL DEFAULT 'pending', -- pending | running | done | failed
  priority         integer DEFAULT 0,
  items_collected  integer DEFAULT 0,
  note             text,
  created_at       timestamptz DEFAULT now(),
  completed_at     timestamptz
);
CREATE INDEX IF NOT EXISTS idx_missions_date_status ON research_missions(mission_date, status);

-- 바이마에서 수집한 실측 후보 (소싱의 원천 데이터)
CREATE TABLE IF NOT EXISTS buyma_candidates (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyma_item_id    text UNIQUE NOT NULL,
  buyma_url        text,
  name_jp          text,
  brand            text,
  price_jpy        integer,
  wish_count       integer,                     -- ほしいもの(찜) 수
  access_count     integer,                     -- 조회수
  inquiry_recent   boolean,                     -- 최근 문의 존재
  listed_date      date,                        -- 등록일 (썸네일 URL 날짜 추출 — V1 기법)
  seller_id        text,
  seller_name      text,
  seller_type      text,                        -- normal | premium | bulk (추정)
  rank_position    integer,
  image_url        text,
  mission_id       uuid REFERENCES research_missions(id) ON DELETE SET NULL,
  method           text DEFAULT 'A',
  status           text NOT NULL DEFAULT 'collected', -- collected | enriched | verified | promoted | discarded
  raw              jsonb,
  first_seen_at    timestamptz DEFAULT now(),
  last_seen_at     timestamptz DEFAULT now(),
  created_at       timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_candidates_status ON buyma_candidates(status);
CREATE INDEX IF NOT EXISTS idx_candidates_mission ON buyma_candidates(mission_id);
CREATE INDEX IF NOT EXISTS idx_candidates_listed_date ON buyma_candidates(listed_date);

-- RLS: service role 전용 (확장은 API 경유)
ALTER TABLE research_missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE buyma_candidates ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='research_missions' AND policyname='rm_service_all') THEN
    CREATE POLICY "rm_service_all" ON research_missions FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='buyma_candidates' AND policyname='bc_service_all') THEN
    CREATE POLICY "bc_service_all" ON buyma_candidates FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 확인
SELECT table_name FROM information_schema.tables
WHERE table_name IN ('research_missions','buyma_candidates');

-- ============================================================
-- Week 8: CS 자동화 — cs_threads 테이블
-- ============================================================

CREATE TABLE IF NOT EXISTS cs_threads (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        text,
  customer_name   text,
  customer_message text NOT NULL,
  ai_reply        text,
  final_reply     text,
  status          text DEFAULT 'pending'   CHECK (status IN ('pending','generating','replied','escalated')),
  category        text DEFAULT '기타'      CHECK (category IN ('배송','환불','상품문의','기타')),
  language        text DEFAULT 'ja',
  notes           text,
  created_at      timestamptz DEFAULT now(),
  replied_at      timestamptz
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_cs_status      ON cs_threads(status);
CREATE INDEX IF NOT EXISTS idx_cs_created_at  ON cs_threads(created_at DESC);

-- RLS
ALTER TABLE cs_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cs_service_all"  ON cs_threads FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "cs_anon_select"  ON cs_threads FOR SELECT TO anon USING (true);
CREATE POLICY "cs_anon_insert"  ON cs_threads FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "cs_anon_update"  ON cs_threads FOR UPDATE TO anon USING (true);

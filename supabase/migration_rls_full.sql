-- ============================================================
-- 협업 테이블 anon 정책 보강 (user_sessions, work_locks, activity_feed, approvals)
-- ============================================================

DO $$ BEGIN
  -- user_sessions
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_sessions' AND policyname='us_anon_all') THEN
    CREATE POLICY "us_anon_all" ON user_sessions FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
  -- work_locks
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='work_locks' AND policyname='wl_anon_all') THEN
    CREATE POLICY "wl_anon_all" ON work_locks FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
  -- activity_feed
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='activity_feed' AND policyname='af_anon_select') THEN
    CREATE POLICY "af_anon_select" ON activity_feed FOR SELECT TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='activity_feed' AND policyname='af_anon_insert') THEN
    CREATE POLICY "af_anon_insert" ON activity_feed FOR INSERT TO anon WITH CHECK (true);
  END IF;
  -- approvals
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='approvals' AND policyname='ap_anon_all') THEN
    CREATE POLICY "ap_anon_all" ON approvals FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;

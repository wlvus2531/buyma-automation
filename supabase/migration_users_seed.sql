-- ============================================================
-- users 테이블 시드 + anon 정책 보강
-- /today, /owner 페이지가 자가 복구되도록
-- ============================================================

-- 1) anon 정책 추가 (없으면)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='users' AND policyname='users_anon_select') THEN
    CREATE POLICY "users_anon_select" ON users FOR SELECT TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='users' AND policyname='users_anon_insert') THEN
    CREATE POLICY "users_anon_insert" ON users FOR INSERT TO anon WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='users' AND policyname='users_anon_update') THEN
    CREATE POLICY "users_anon_update" ON users FOR UPDATE TO anon USING (true);
  END IF;
END $$;

-- 2) 시드 데이터 (없을 때만)
INSERT INTO users (name, role, avatar_emoji, is_active)
SELECT '운영자', 'operator', '🧑‍💼', true
WHERE NOT EXISTS (SELECT 1 FROM users WHERE role='operator');

INSERT INTO users (name, role, avatar_emoji, is_active)
SELECT '사장님', 'owner', '👔', true
WHERE NOT EXISTS (SELECT 1 FROM users WHERE role='owner');

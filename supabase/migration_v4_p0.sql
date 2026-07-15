-- ============================================================
-- v4 P0 — 기반 정비 마이그레이션
-- ① 핵심 테이블 스키마를 코드로 문서화 (CREATE TABLE IF NOT EXISTS)
-- ② brand_rules 하드 필터 테이블 + 시드
-- ③ RLS 잠금: 비즈니스 테이블에서 anon 쓰기 제거
-- Supabase SQL Editor에서 실행. 전부 멱등(idempotent).
-- ============================================================

-- ────────────────────────────────────────────────
-- ① 스키마 문서화 (기존 운영 테이블 — 이미 존재하면 no-op)
-- ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS products (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_kr            text NOT NULL,
  name_jp            text,
  brand              text,
  source_url         text,
  source_mall        text,
  cost_krw           integer,
  ship_krw           integer,
  list_price_jpy     integer,
  margin_pct         numeric,
  status             text DEFAULT 'sourcing',
  listing_status     text,
  thumbnail_url      text,
  ai_score           integer,
  ai_reason          text,
  category           text,
  trend_keyword      text,
  skip_reason        text,
  decided_at         timestamptz,
  title_jp           text,
  description_jp     text,
  buyma_category     text,
  listing_tags       text[],
  listed_at          timestamptz,
  buyma_listing_url  text,
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id       uuid,
  name          text NOT NULL,
  role          text NOT NULL DEFAULT 'operator', -- operator | owner
  avatar_emoji  text,
  is_active     boolean DEFAULT true,
  push_endpoint text,
  push_keys     jsonb,
  created_at    timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS approvals (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by   text,
  request_type   text NOT NULL,
  target_type    text,
  target_id      text,
  target_label   text,
  proposed_value jsonb,
  rule_violated  text,
  status         text DEFAULT 'pending',
  decided_by     uuid,
  decided_at     timestamptz,
  decision_value jsonb,
  decision_note  text,
  pushed_at      timestamptz,
  expires_at     timestamptz,
  created_at     timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS activity_feed (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_label  text,
  action_type  text NOT NULL,
  target_type  text,
  target_id    text,
  target_label text,
  details      jsonb,
  created_at   timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_sessions (
  user_id    uuid PRIMARY KEY,
  page       text,
  last_seen  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS work_locks (
  resource   text PRIMARY KEY,
  user_id    uuid,
  user_label text,
  locked_at  timestamptz DEFAULT now()
);

-- ────────────────────────────────────────────────
-- ② brand_rules — 하드 필터 (가품/금지 브랜드/금지 사이트)
--    rule_type:
--      blocked          출품 자체 불가 → 파이프라인 전 단계 차단
--      restricted       출품 셀러 제한 (신청 필요) → 차단
--      permission       브랜드 판매권한 필요 → 차단
--      image_warning    출품 가능하나 공식 이미지 사용 금지 → 플래그
--      site_blocked     구매 금지 사이트 → 구매처 후보 제외
--      site_whitelist   신뢰 가능 구매처 → 우선 사용
-- ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS brand_rules (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_type  text NOT NULL,
  name       text NOT NULL,            -- 브랜드명 또는 사이트명/도메인
  name_alt   text,                     -- 한글/영문 병기
  reason     text,
  source     text DEFAULT 'seed_2026', -- 출처 (강의자료 2026)
  is_active  boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE (rule_type, name)
);

CREATE INDEX IF NOT EXISTS idx_brand_rules_type ON brand_rules(rule_type) WHERE is_active;

-- 시드 (ON CONFLICT DO NOTHING → 재실행 안전)
INSERT INTO brand_rules (rule_type, name, name_alt, reason) VALUES
-- 출품 셀러 제한 브랜드
('restricted','Daniel Wellington',NULL,'출품 가능 셀러 제한 — 판매실적 후 신청 가능'),
('restricted','MONCLER',NULL,'출품 가능 셀러 제한'),
('restricted','Supreme',NULL,'출품 가능 셀러 제한'),
('restricted','Oliver Gal',NULL,'출품 가능 셀러 제한'),
('restricted','CANADA GOOSE',NULL,'출품 가능 셀러 제한'),
('restricted','UGG',NULL,'출품 가능 셀러 제한'),
('restricted','Louis Vuitton',NULL,'바이마 사무국 개별 심사 — 회피 권장'),
-- 출품 자체 불가
('blocked','OIOICOLLECTION','오아이오아이','바이마 출품 금지'),
('blocked','A FEW GOOD KIDS',NULL,'바이마 출품 금지 (일부 권리자만 가능)'),
-- 브랜드 판매권한 필요 (무단 출품 시 삭제/계정 경고)
('permission','ROMANTIC CROWN','로맨틱 크라운','브랜드 판매권한 필요'),
('permission','ASCLO','에즈클로','브랜드 판매권한 필요 — 특히 주의'),
('permission','Paragraph','파라그래프','브랜드 판매권한 필요'),
('permission','23.65',NULL,'브랜드 판매권한 필요'),
('permission','Raucohouse','라우코하우스','브랜드 판매권한 필요'),
('permission','HI FI FNK','하이파이펑크','브랜드 판매권한 필요'),
('permission','SCENERITY','시너리티','브랜드 판매권한 필요'),
('permission','NONCODE','논코드','브랜드 판매권한 필요'),
('permission','mnem','므넴','브랜드 판매권한 필요'),
('permission','GRAVER','그레이버','브랜드 판매권한 필요'),
('permission','FUCKBOY','퍽보이','브랜드 판매권한 필요'),
('permission','HIEMS COR',NULL,'브랜드 판매권한 필요'),
('permission','VETEZE','베테제','브랜드 판매권한 필요 — 특히 주의'),
('permission','MCNCHIPS','맥앤칩스','브랜드 판매권한 필요'),
('permission','AAKE','아케','브랜드 판매권한 필요'),
('permission','ANGLAN','앵글런','브랜드 판매권한 필요'),
('permission','YOURNUS','유어너스','브랜드 판매권한 필요'),
('permission','2plan','투플랜','브랜드 판매권한 필요 — 특히 주의'),
('permission','IN A ROW','인어로우','브랜드 판매권한 필요'),
('permission','U LAN','유란','브랜드 판매권한 필요'),
('permission','HOLY IN CODE','홀리인코드','브랜드 판매권한 필요 — 특히 주의'),
('permission','INCHANT ME','인챈트미','브랜드 판매권한 필요'),
('permission','Anyone more','애니원모어','브랜드 판매권한 필요'),
('permission','THE MOZZ','더모즈','브랜드 판매권한 필요'),
('permission','oan','오안','브랜드 판매권한 필요'),
('permission','MAISON MINED','메종미네드','브랜드 판매권한 필요'),
('permission','BAON','바온','브랜드 판매권한 필요'),
('permission','DISCERNMENT','디서먼트','브랜드 판매권한 필요'),
('permission','BOK PLACE','복플레이스','브랜드 판매권한 필요'),
('permission','PORTERNA','포르테나','브랜드 판매권한 필요'),
('permission','WOOHWA','우화','브랜드 판매권한 필요'),
('permission','Acubi Club','아쿠비클럽','브랜드 판매권한 필요'),
('permission','AJO AJOBYAJO','아조바이아조','브랜드 판매권한 필요'),
('permission','re:LAN','리런','브랜드 판매권한 필요'),
('permission','modernif','모던이프','브랜드 판매권한 필요'),
('permission','SATiiiZ','사티즈','브랜드 판매권한 필요'),
('permission','DEARMINE','디어마인','브랜드 판매권한 필요'),
('permission','WONDER WONDER','원더원더','브랜드 판매권한 필요'),
('permission','AWESOME NEEDS','어썸니즈','브랜드 판매권한 필요'),
('permission','COSYHARU','코지하루','브랜드 판매권한 필요 — 특히 주의'),
('permission','EEUN','이은','브랜드 판매권한 필요'),
('permission','COLOR iN ID','컬러인아이디','브랜드 판매권한 필요'),
('permission','dydoshop','디와이디샵','브랜드 판매권한 필요'),
('permission','BOLSAC','볼삭','브랜드 판매권한 필요'),
('permission','COAP','코압','브랜드 판매권한 필요'),
('permission','as"on','아즈온','브랜드 판매권한 필요 — 특히 주의'),
('permission','suzen','수젠','브랜드 판매권한 필요'),
('permission','WV PROJECT','더블유브이프로젝트','브랜드 판매권한 필요 — 특히 주의'),
('permission','dyclez','다이클레즈','브랜드 판매권한 필요'),
('permission','EZKATON','에즈카톤','브랜드 판매권한 필요'),
('permission','FEPL','페플','브랜드 판매권한 필요'),
('permission','Jemut','제멋','브랜드 판매권한 필요'),
('permission','perstep','퍼스텝','브랜드 판매권한 필요'),
('permission','PUNCHLINE','펀치라인','브랜드 판매권한 필요'),
('permission','TWN','티더블유엔','브랜드 판매권한 필요'),
('permission','UNDERBASE','언더베이스','브랜드 판매권한 필요'),
('permission','UBESCO','유베스코','브랜드 판매권한 필요'),
-- 이미지 지적재산권 주의 (출품 가능, 공식 이미지 사용 금지 → 직접 촬영/후기 사진)
('image_warning','LOEWE',NULL,'공식 이미지 사용 시 퇴점 리스크'),
('image_warning','HERMES',NULL,'공식 이미지 사용 시 퇴점 리스크'),
('image_warning','Max Mara',NULL,'공식 이미지 사용 시 퇴점 리스크'),
('image_warning','Burberry',NULL,'공식 이미지 사용 시 퇴점 리스크'),
('image_warning','Coach',NULL,'공식 이미지 사용 시 퇴점 리스크'),
('image_warning','CELINE',NULL,'공식 이미지 사용 시 퇴점 리스크'),
('image_warning','MiuMiu',NULL,'공식 이미지 사용 시 퇴점 리스크'),
('image_warning','PRADA',NULL,'공식 이미지 사용 시 퇴점 리스크'),
('image_warning','STONE ISLAND',NULL,'공식 이미지 사용 시 퇴점 리스크'),
('image_warning','Tiffany & Co',NULL,'공식 이미지 사용 시 퇴점 리스크'),
('image_warning','CHROME HEARTS',NULL,'공식 이미지 사용 시 퇴점 리스크'),
('image_warning','Anya Hindmarch',NULL,'공식 이미지 사용 시 퇴점 리스크'),
('image_warning','Acne Studios',NULL,'공식 이미지 사용 시 퇴점 리스크'),
('image_warning','Alexander Wang',NULL,'공식 이미지 사용 시 퇴점 리스크'),
('image_warning','Valextra',NULL,'공식 이미지 사용 시 퇴점 리스크'),
('image_warning','kate spade',NULL,'공식 이미지 사용 시 퇴점 리스크'),
('image_warning','GIVENCHY',NULL,'공식 이미지 사용 시 퇴점 리스크'),
('image_warning','Christian Louboutin',NULL,'공식 이미지 사용 시 퇴점 리스크'),
('image_warning','SWAROVSKI',NULL,'공식 이미지 사용 시 퇴점 리스크'),
('image_warning','Mulberry',NULL,'공식 이미지 사용 시 퇴점 리스크'),
('image_warning','Dior',NULL,'공식 이미지 사용 시 퇴점 리스크'),
('image_warning','VALENTINO',NULL,'공식 이미지 사용 시 퇴점 리스크'),
('image_warning','RIMOWA',NULL,'공식 이미지 사용 시 퇴점 리스크'),
('image_warning','BLVCK PARIS',NULL,'공식 이미지 사용 시 퇴점 리스크'),
('image_warning','mahagrid','마하그리드','공식 이미지 사용 시 퇴점 리스크'),
('image_warning','Mardi Mercredi','마르디메크르디','공식 이미지 사용 시 퇴점 리스크'),
('image_warning','Nice Ghost Club','나이스고스트클럽','공식 이미지 사용 시 퇴점 리스크'),
('image_warning','thisisneverthat','디스이즈네버댓','공식 이미지 사용 시 퇴점 리스크'),
('image_warning','MARHEN.J','말헨제이','공식 이미지 사용 시 퇴점 리스크'),
('image_warning','ISTKUNST','이스트쿤스트','공식 이미지 사용 시 퇴점 리스크'),
('image_warning','vunque','분크','공식 이미지 사용 시 퇴점 리스크'),
('image_warning','Telfar',NULL,'공식 이미지 사용 시 퇴점 리스크'),
('image_warning','Fair Liar','페어라이어','공식 이미지 사용 시 퇴점 리스크'),
('image_warning','Casetify','케이스티파이','공식 이미지 사용 시 퇴점 리스크'),
('image_warning','HUF',NULL,'공식 이미지 사용 시 퇴점 리스크'),
('image_warning','THOM BROWNE',NULL,'공식 이미지 사용 시 퇴점 리스크'),
('image_warning','SOREL',NULL,'공식 이미지 사용 시 퇴점 리스크'),
('image_warning','ASOS',NULL,'공식 이미지 사용 시 퇴점 리스크'),
('image_warning','kiehls','키엘','공식 이미지 사용 시 퇴점 리스크'),
('image_warning','DRIES VAN NOTEN',NULL,'공식 이미지 사용 시 퇴점 리스크'),
('image_warning','Tod''s',NULL,'공식 이미지 사용 시 퇴점 리스크'),
('image_warning','Marc Jacobs',NULL,'공식 이미지 사용 시 퇴점 리스크'),
('image_warning','Matin Kim','마뗑킴','공식 이미지 사용 시 퇴점 리스크'),
('image_warning','DINT','딘트','공식 이미지 사용 시 퇴점 리스크'),
('image_warning','lululemon','룰루레몬','공식 이미지 사용 시 퇴점 리스크'),
('image_warning','sculptor','스컬프터','공식 이미지 사용 시 퇴점 리스크'),
('image_warning','gentle monster','젠틀몬스터','공식 이미지 사용 시 퇴점 리스크'),
('image_warning','PUMA x AMI',NULL,'공식 이미지 사용 시 퇴점 리스크'),
('image_warning','J.ESTINA','제이에스티나','공식 이미지 사용 시 퇴점 리스크'),
('image_warning','TAMBURINS','탬버린즈','공식 이미지 사용 시 퇴점 리스크'),
('image_warning','STAND OIL','스탠드오일','공식 이미지 사용 시 퇴점 리스크'),
('image_warning','marithe','마리떼','공식 이미지 사용 시 퇴점 리스크'),
('image_warning','ROH SEOUL','로서울','공식 이미지 사용 시 퇴점 리스크'),
('image_warning','KIJUN','기준','공식 이미지 사용 시 퇴점 리스크'),
('image_warning','ORR',NULL,'공식 이미지 사용 시 퇴점 리스크 + 판매권한'),
('image_warning','Barbour','바버','공식 이미지 사용 시 퇴점 리스크'),
-- 구매 금지 사이트
('site_blocked','오픈마켓 우리들 쇼핑',NULL,'가품 위험 — 구매 금지'),
('site_blocked','플레이스 707',NULL,'가품 위험 — 구매 금지'),
('site_blocked','위핑',NULL,'가품 위험 — 구매 금지'),
('site_blocked','잇썸몰',NULL,'가품 위험 — 구매 금지'),
-- 신뢰 가능 국내 편집샵 화이트리스트
('site_whitelist','musinsa.com','무신사','신뢰 편집샵'),
('site_whitelist','29cm.co.kr','29CM','신뢰 편집샵'),
('site_whitelist','wconcept.co.kr','W컨셉','신뢰 편집샵'),
('site_whitelist','eqlstore.com','한섬 EQL','신뢰 편집샵'),
('site_whitelist','hago.kr','HAGO','신뢰 편집샵'),
('site_whitelist','folderstyle.com','폴더','신뢰 편집샵'),
('site_whitelist','shoemarker.co.kr','슈마커','신뢰 편집샵'),
('site_whitelist','abcmart.co.kr','ABC마트','신뢰 편집샵'),
('site_whitelist','kasina.co.kr','카시나','신뢰 편집샵'),
('site_whitelist','fashionplus.co.kr','패션플러스','신뢰 편집샵'),
('site_whitelist','ssfshop.com','SSF','신뢰 편집샵'),
('site_whitelist','okmall.com','오케이몰','신뢰 편집샵 + 병행수입'),
-- 신뢰 병행수입 (법인 확인된 곳)
('site_whitelist','brickmansion.co.kr','브릭맨션','신뢰 병행수입'),
('site_whitelist','bazig.com','베이지그','신뢰 병행수입'),
('site_whitelist','smartstore.naver.com/dlc','대림코퍼레이션','신뢰 병행수입 (스마트스토어 법인)'),
('site_whitelist','smartstore.naver.com/aint','올아이원트','신뢰 병행수입 (스마트스토어 법인)'),
('site_whitelist','smartstore.naver.com/bazig','베이지그 스토어','신뢰 병행수입 (스마트스토어 법인)')
ON CONFLICT (rule_type, name) DO NOTHING;

-- brand_rules RLS: 읽기 공개(클라이언트 UI 표시용), 쓰기는 service role만
ALTER TABLE brand_rules ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='brand_rules' AND policyname='br_anon_select') THEN
    CREATE POLICY "br_anon_select" ON brand_rules FOR SELECT TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='brand_rules' AND policyname='br_service_all') THEN
    CREATE POLICY "br_service_all" ON brand_rules FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ────────────────────────────────────────────────
-- ③ RLS 잠금 — 비즈니스 테이블에서 anon 쓰기 제거
--    (모든 쓰기는 API 라우트의 service role 경유)
--    유지: 협업 테이블(approvals/activity_feed/user_sessions/work_locks)의
--          anon 정책 — 클라이언트 Realtime/직접 쓰기가 필요
-- ────────────────────────────────────────────────

-- competitor_prices: 확장은 /api/monitor/report(service role) 경유 → anon 불필요
DROP POLICY IF EXISTS "cp_anon_insert" ON competitor_prices;
DROP POLICY IF EXISTS "cp_anon_select" ON competitor_prices;

-- cs_threads: 전부 API 경유 → anon 불필요
DROP POLICY IF EXISTS "cs_anon_insert" ON cs_threads;
DROP POLICY IF EXISTS "cs_anon_update" ON cs_threads;
DROP POLICY IF EXISTS "cs_anon_select" ON cs_threads;

-- users: 클라이언트가 사용자 목록 읽기는 필요(프레즌스 표시), 쓰기는 제거
DROP POLICY IF EXISTS "users_anon_insert" ON users;
DROP POLICY IF EXISTS "users_anon_update" ON users;

-- products: RLS 활성화 (anon 정책 자체가 없어야 함 — 있으면 제거)
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "products_anon_all" ON products;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='products' AND policyname='products_service_all') THEN
    CREATE POLICY "products_service_all" ON products FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ────────────────────────────────────────────────
-- 확인 쿼리
-- ────────────────────────────────────────────────
SELECT tablename, policyname, roles FROM pg_policies
WHERE tablename IN ('products','brand_rules','competitor_prices','cs_threads','users')
ORDER BY tablename, policyname;

SELECT rule_type, count(*) FROM brand_rules GROUP BY rule_type ORDER BY rule_type;

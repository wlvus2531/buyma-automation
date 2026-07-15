/**
 * 하드 필터 — 금지/제한 브랜드 · 금지/신뢰 구매처 (v4 P0)
 *
 * 원천 데이터는 Supabase `brand_rules` 테이블 (migration_v4_p0.sql 시드).
 * 파이프라인 3중 차단 지점:
 *   ① 소싱 후보 생성 직후 (sourcing-engine)
 *   ② 등록 자료 준비 시 (listing-engine)
 *   ③ 구매처 검증 시 (P2 purchase_sources)
 */

import { SupabaseClient } from '@supabase/supabase-js';

export type BrandRuleType =
  | 'blocked'         // 출품 자체 불가
  | 'restricted'      // 출품 셀러 제한
  | 'permission'      // 브랜드 판매권한 필요
  | 'image_warning'   // 공식 이미지 사용 금지 (출품은 가능)
  | 'site_blocked'    // 구매 금지 사이트
  | 'site_whitelist'; // 신뢰 구매처

export interface BrandRule {
  rule_type: BrandRuleType;
  name: string;
  name_alt: string | null;
  reason: string | null;
}

export interface BrandCheckResult {
  allowed: boolean;             // false = 파이프라인에서 제외
  imageWarning: boolean;        // true = 공식 이미지 사용 금지 플래그
  matchedRule: BrandRule | null;
}

/** 브랜드명 정규화: 소문자 + 공백/특수문자 제거 */
function norm(s: string): string {
  return s.toLowerCase().replace(/[\s.·'"“”‘’\-_]/g, '');
}

let cache: { rules: BrandRule[]; at: number } | null = null;
const CACHE_TTL_MS = 10 * 60 * 1000;

export async function loadBrandRules(supabase: SupabaseClient): Promise<BrandRule[]> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.rules;
  const { data, error } = await supabase
    .from('brand_rules')
    .select('rule_type, name, name_alt, reason')
    .eq('is_active', true);
  if (error) throw new Error(`brand_rules 로드 실패: ${error.message}`);
  cache = { rules: (data ?? []) as BrandRule[], at: Date.now() };
  return cache.rules;
}

/** 브랜드가 출품 가능한지 검사 (blocked/restricted/permission → 차단) */
export function checkBrand(brand: string | null | undefined, rules: BrandRule[]): BrandCheckResult {
  if (!brand) return { allowed: true, imageWarning: false, matchedRule: null };
  const b = norm(brand);
  if (!b) return { allowed: true, imageWarning: false, matchedRule: null };

  for (const r of rules) {
    if (r.rule_type === 'site_blocked' || r.rule_type === 'site_whitelist') continue;
    const names = [r.name, r.name_alt].filter(Boolean).map((n) => norm(n as string));
    // 양방향 부분일치: "MONCLER GENIUS" ⊃ "moncler", "23.65 hi" ⊃ "2365"
    const hit = names.some((n) => n.length >= 2 && (b.includes(n) || n.includes(b)));
    if (!hit) continue;
    if (r.rule_type === 'image_warning') {
      return { allowed: true, imageWarning: true, matchedRule: r };
    }
    return { allowed: false, imageWarning: false, matchedRule: r };
  }
  return { allowed: true, imageWarning: false, matchedRule: null };
}

/** 구매처 URL/몰명이 금지 사이트인지 검사 */
export function checkSource(urlOrMall: string | null | undefined, rules: BrandRule[]): BrandCheckResult {
  if (!urlOrMall) return { allowed: true, imageWarning: false, matchedRule: null };
  const s = norm(urlOrMall);
  for (const r of rules) {
    if (r.rule_type !== 'site_blocked') continue;
    const names = [r.name, r.name_alt].filter(Boolean).map((n) => norm(n as string));
    if (names.some((n) => n.length >= 2 && s.includes(n))) {
      return { allowed: false, imageWarning: false, matchedRule: r };
    }
  }
  return { allowed: true, imageWarning: false, matchedRule: null };
}

/** 구매처가 화이트리스트인지 (P2 구매처 검증에서 우선순위 판단용) */
export function isWhitelistedSource(urlOrMall: string | null | undefined, rules: BrandRule[]): boolean {
  if (!urlOrMall) return false;
  const s = norm(urlOrMall);
  return rules.some(
    (r) =>
      r.rule_type === 'site_whitelist' &&
      [r.name, r.name_alt].filter(Boolean).some((n) => s.includes(norm(n as string)))
  );
}

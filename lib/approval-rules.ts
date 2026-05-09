/**
 * 룰 기반 자동 승인 요청 생성
 *
 * 트리거:
 *  - 마진 25% 미만 등록 시도 → price_below_margin
 *  - 단가 ¥10,000+ 가격 결정 → price_high_unit
 *  - 신규 카테고리 진입 → new_category
 *  - 가격 5%+ 인하 결정 → large_price_drop
 *
 * 사용:
 *   await maybeRequestApproval({ kind: 'register', product, requestedBy });
 */

import { createClient } from '@supabase/supabase-js';
import type { ApprovalRequestType } from '@/types';

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

interface ProductLike {
  id: string;
  name_kr: string;
  name_jp?: string | null;
  brand?: string | null;
  buyma_category?: string | null;
  cost_krw?: number;
  list_price_jpy?: number | null;
  margin_pct?: number | null;
}

const MIN_MARGIN_PCT = 25;
const HIGH_UNIT_JPY = 10_000;

/**
 * 등록 시 룰 검사 → 위반이면 approval 생성하고 푸시 발송 트리거
 * 반환값: 생성된 approval id 배열 (승인 대기로 막힌 게 있는지 운영자가 알 수 있도록)
 */
export async function maybeRequestApprovalForListing(
  product: ProductLike,
  requestedBy: string | null
): Promise<string[]> {
  const supabase = getAdminSupabase();
  const created: string[] = [];

  const violations: { type: ApprovalRequestType; rule: string; proposed: Record<string, unknown> }[] = [];

  // 1. 마진 부족
  if (product.margin_pct != null && product.margin_pct < MIN_MARGIN_PCT) {
    violations.push({
      type: 'price_below_margin',
      rule: `마진 ${product.margin_pct}% (룰: ${MIN_MARGIN_PCT}% 이상)`,
      proposed: {
        price_jpy: product.list_price_jpy,
        margin_pct: product.margin_pct,
        cost_krw: product.cost_krw,
      },
    });
  }

  // 2. 고가 상품
  if (product.list_price_jpy != null && product.list_price_jpy >= HIGH_UNIT_JPY) {
    violations.push({
      type: 'price_high_unit',
      rule: `단가 ¥${product.list_price_jpy.toLocaleString()} (¥${HIGH_UNIT_JPY.toLocaleString()}+ 사장님 결정)`,
      proposed: {
        price_jpy: product.list_price_jpy,
        margin_pct: product.margin_pct,
      },
    });
  }

  // 3. 신규 카테고리 — 최근 30일 내 등록된 적 없는 buyma_category
  if (product.buyma_category) {
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const { count } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('buyma_category', product.buyma_category)
      .eq('listing_status', 'listed')
      .gte('listed_at', since.toISOString());
    if ((count ?? 0) === 0) {
      violations.push({
        type: 'new_category',
        rule: `신규 카테고리: ${product.buyma_category}`,
        proposed: {
          buyma_category: product.buyma_category,
          price_jpy: product.list_price_jpy,
        },
      });
    }
  }

  // 위반 항목별로 approval 생성 + 푸시 트리거
  for (const v of violations) {
    const { data: approval, error } = await supabase
      .from('approvals')
      .insert({
        requested_by: requestedBy,
        request_type: v.type,
        target_type: 'product',
        target_id: product.id,
        target_label: product.name_jp || product.name_kr,
        proposed_value: v.proposed,
        rule_violated: v.rule,
        status: 'pending',
      })
      .select('id')
      .maybeSingle();

    if (!error && approval?.id) {
      created.push(approval.id);
      // 푸시 비동기 발송 (실패해도 등록은 진행)
      fireApprovalPush(approval.id);
    }
  }

  return created;
}

function fireApprovalPush(approvalId: string) {
  const base = process.env.NEXT_PUBLIC_SITE_URL || '';
  const url = base ? `${base}/api/approvals/push` : '/api/approvals/push';
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ approval_id: approvalId }),
  }).catch((e) => console.error('[approval-rules] push trigger 실패:', e));
}

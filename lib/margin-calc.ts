/**
 * 마진 계산기 — v4 P2 (바이마_올인원.xlsx 로직 이식 + 부가세 환급 계산)
 *
 * 원가합계(원) = 구매가 + 국내배송비 + 배대지비용
 * 원가(엔) = 원가합계 / 환율(1엔당 원)
 * 수수료(엔) = 판매가 × 5.4%
 * 마진(엔) = 판매가 − 수수료 − 원가(엔)
 *
 * 부가세 환급(영세율 수출): 환급액 = 구매가 × 10/110
 * → 환급 후 원가 = (구매가 − 환급액) + 배송 + 배대지
 *
 * 기준(방법론): 환급 후 마진율 5% 이상이면 업로드 대상
 */

export const BUYMA_FEE_RATE = 0.054;      // 바이마 수수료 5.4%
export const DEFAULT_SHIP_KRW = 3000;     // 국내 기본 배송비
export const DEFAULT_FORWARDING_KRW = 2500; // 배대지 기본 (무게별 실변동)
export const VAT_REFUND_RATE = 10 / 110;  // 부가세 환급 비율
export const MIN_MARGIN_PCT = 5;          // 업로드 기준 (환급 후)

export interface MarginInput {
  costKrw: number;          // 구매가(원)
  sellPriceJpy: number;     // 바이마 판매가(엔)
  krwPerJpy: number;        // 환율 (1엔당 원, 예: 9.5)
  shipKrw?: number;
  forwardingKrw?: number;
}

export interface MarginResult {
  cost_total_krw: number;
  cost_jpy: number;
  fee_jpy: number;
  margin_jpy: number;            // 환급 전 마진(엔)
  margin_pct: number;            // 환급 전 마진율(%)
  vat_refund_krw: number;        // 환급액(원)
  margin_jpy_after_refund: number;
  margin_pct_after_refund: number;
  passes: boolean;               // 환급 후 5% 이상
}

export function calcMargin(input: MarginInput): MarginResult {
  const ship = input.shipKrw ?? DEFAULT_SHIP_KRW;
  const fwd = input.forwardingKrw ?? DEFAULT_FORWARDING_KRW;

  const costTotalKrw = input.costKrw + ship + fwd;
  const costJpy = costTotalKrw / input.krwPerJpy;
  const feeJpy = input.sellPriceJpy * BUYMA_FEE_RATE;

  const marginJpy = input.sellPriceJpy - feeJpy - costJpy;
  const marginPct = (marginJpy / input.sellPriceJpy) * 100;

  const refundKrw = input.costKrw * VAT_REFUND_RATE;
  const costJpyAfter = (costTotalKrw - refundKrw) / input.krwPerJpy;
  const marginJpyAfter = input.sellPriceJpy - feeJpy - costJpyAfter;
  const marginPctAfter = (marginJpyAfter / input.sellPriceJpy) * 100;

  const r = (n: number) => Math.round(n * 10) / 10;
  return {
    cost_total_krw: Math.round(costTotalKrw),
    cost_jpy: Math.round(costJpy),
    fee_jpy: Math.round(feeJpy),
    margin_jpy: Math.round(marginJpy),
    margin_pct: r(marginPct),
    vat_refund_krw: Math.round(refundKrw),
    margin_jpy_after_refund: Math.round(marginJpyAfter),
    margin_pct_after_refund: r(marginPctAfter),
    passes: marginPctAfter >= MIN_MARGIN_PCT,
  };
}

/** 환율 조회 (1엔당 원) — open.er-api.com, 실패 시 9.5 폴백 */
export async function fetchKrwPerJpy(): Promise<number> {
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/JPY', { signal: AbortSignal.timeout(8000) });
    const data = await res.json();
    const rate = data?.rates?.KRW;
    if (typeof rate === 'number' && rate > 5 && rate < 20) return rate;
  } catch { /* 폴백 */ }
  return 9.5;
}

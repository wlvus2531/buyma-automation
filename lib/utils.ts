import type { MarginCalcInput, MarginCalcResult } from "./types";

export function calcMargin(input: MarginCalcInput): MarginCalcResult {
  const { sellingPrice, purchasePrice, shippingCost, exchangeRate, buymaFeeRate, vatRefundRate } = input;

  const buymaFeeJpy = sellingPrice * (buymaFeeRate / 100);
  const netSellingJpy = sellingPrice - buymaFeeJpy;
  const costKrw = purchasePrice + shippingCost;
  const costJpy = costKrw / exchangeRate;
  const vatRefundKrw = purchasePrice * (vatRefundRate / 100);
  const vatRefundJpy = vatRefundKrw / exchangeRate;

  const profitWithoutRefund = netSellingJpy - costJpy;
  const profitWithRefund = netSellingJpy - costJpy + vatRefundJpy;

  const marginWithoutRefund = sellingPrice > 0 ? (profitWithoutRefund / sellingPrice) * 100 : 0;
  const marginWithRefund = sellingPrice > 0 ? (profitWithRefund / sellingPrice) * 100 : 0;

  return {
    netSellingJpy,
    costJpy,
    vatRefundJpy,
    profitWithRefund,
    profitWithoutRefund,
    marginWithRefund,
    marginWithoutRefund,
    buymaFeeJpy,
  };
}

export function formatKrw(amount: number): string {
  return new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW" }).format(amount);
}

export function formatJpy(amount: number): string {
  return new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY" }).format(amount);
}

export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

export function marginColor(rate: number): string {
  if (rate >= 25) return "text-green-600";
  if (rate >= 15) return "text-blue-600";
  if (rate >= 5) return "text-yellow-600";
  return "text-red-600";
}

export function marginBg(rate: number): string {
  if (rate >= 25) return "bg-green-100 text-green-800";
  if (rate >= 15) return "bg-blue-100 text-blue-800";
  if (rate >= 5) return "bg-yellow-100 text-yellow-800";
  return "bg-red-100 text-red-800";
}

export function getSeason(date: Date = new Date()): string {
  const month = date.getMonth() + 1;
  if (month >= 3 && month <= 5) return "봄";
  if (month >= 6 && month <= 8) return "여름";
  if (month >= 9 && month <= 11) return "가을";
  return "겨울";
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function statusBadgeClass(status: string): string {
  const map: Record<string, string> = {
    조사중: "bg-gray-100 text-gray-700",
    등록완료: "bg-blue-100 text-blue-700",
    판매중: "bg-green-100 text-green-700",
    일시정지: "bg-yellow-100 text-yellow-700",
    중단: "bg-red-100 text-red-700",
    주문접수: "bg-purple-100 text-purple-700",
    발주완료: "bg-indigo-100 text-indigo-700",
    배송중: "bg-blue-100 text-blue-700",
    배송완료: "bg-teal-100 text-teal-700",
    정산완료: "bg-green-100 text-green-700",
  };
  return map[status] ?? "bg-gray-100 text-gray-700";
}

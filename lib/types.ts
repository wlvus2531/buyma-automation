export type SourcingStatus = "조사중" | "등록완료" | "판매중" | "일시정지" | "중단";

export interface SourcingItem {
  id: string;
  productName: string;
  category: string;
  brand: string;
  koreaPurchasePrice: number;   // KRW
  buymaLowestPrice: number;     // JPY
  sellingPrice: number;         // JPY (내 판매가)
  competitorCount: number;
  status: SourcingStatus;
  marginWithRefund: number;     // %
  marginWithoutRefund: number;  // %
  shippingCost: number;         // KRW
  exchangeRate: number;         // KRW per 1 JPY
  notes: string;
  createdAt: string;
}

export type OrderStatus = "주문접수" | "발주완료" | "배송중" | "배송완료" | "정산완료";

export interface Order {
  id: string;
  orderNumber: string;
  productName: string;
  buyerName: string;
  sellingPrice: number;         // JPY
  purchasePrice: number;        // KRW
  shippingCost: number;         // KRW
  exchangeRate: number;
  status: OrderStatus;
  trackingNumber: string;
  orderDate: string;
  shippedDate: string;
  settledDate: string;
  marginJpy: number;
  marginRate: number;           // %
  notes: string;
}

export interface MarginCalcInput {
  sellingPrice: number;         // JPY
  purchasePrice: number;        // KRW
  shippingCost: number;         // KRW
  exchangeRate: number;         // KRW per 1 JPY
  buymaFeeRate: number;         // default 5.4
  vatRefundRate: number;        // default 9.09
}

export interface MarginCalcResult {
  netSellingJpy: number;
  costJpy: number;
  vatRefundJpy: number;
  profitWithRefund: number;
  profitWithoutRefund: number;
  marginWithRefund: number;     // %
  marginWithoutRefund: number;  // %
  buymaFeeJpy: number;
}

export interface AiSourcingItem {
  rank: number;
  productName: string;
  japaneseName: string;
  category: string;
  brand: string;
  koreanPriceRange: string;
  expectedSellingPrice: string;
  competitionLevel: "낮음" | "보통" | "높음";
  expectedMargin: string;
  reason: string;
  sourcingTip: string;
  trend: string;
}

export interface SheetsSyncStatus {
  lastSynced: string | null;
  sourcing: "idle" | "syncing" | "success" | "error";
  orders: "idle" | "syncing" | "success" | "error";
  error: string | null;
}

import type { Order, OrderStatus } from "./types";
import { generateId, calcMargin } from "./utils";

// Buyma CSV 컬럼명 후보 (다양한 버전 대응)
const COL_CANDIDATES = {
  orderNumber: ["注文番号", "受注番号", "オーダー番号", "注文No.", "注文No"],
  orderDate:   ["注文日時", "注文日", "受注日時", "受注日", "購入日"],
  productName: ["商品名", "アイテム名", "商品タイトル", "出品タイトル"],
  buyerName:   ["バイヤー名", "バイヤー", "お客様名", "購入者名", "お届け先名", "お届け先氏名"],
  sellingPrice:["販売価格(円)", "販売価格", "お支払い金額(円)", "お支払い金額", "販売金額", "金額"],
  status:      ["ご注文ステータス", "注文ステータス", "ステータス", "発送状況", "状態"],
  trackingNumber: ["追跡番号", "伝票番号", "配送番号", "追跡コード", "発送番号"],
};

// Buyma 상태 → 앱 상태 매핑
const STATUS_MAP: Record<string, OrderStatus> = {
  "新規":               "주문접수",
  "新規注文":           "주문접수",
  "入金待ち":           "주문접수",
  "未入金":             "주문접수",
  "入金確認済み":       "발주완료",
  "発注済み":           "발주완료",
  "手配中":             "발주완료",
  "発送済み":           "배송중",
  "配送中":             "배송중",
  "配達完了":           "배송완료",
  "受取完了":           "배송완료",
  "精算処理済み":       "정산완료",
  "クリエイター精算済み": "정산완료",
  "精算済み":           "정산완료",
};

function findColIndex(headers: string[], candidates: string[]): number {
  for (const c of candidates) {
    const idx = headers.findIndex(h => h === c || h.includes(c) || c.includes(h));
    if (idx >= 0) return idx;
  }
  return -1;
}

function parsePrice(val: string): number {
  return Number(val.replace(/[^0-9.-]/g, "")) || 0;
}

function parseDate(val: string): string {
  if (!val) return "";
  const m = val.match(/(\d{4})[\/\-年](\d{1,2})[\/\-月](\d{1,2})/);
  if (m) return `${m[1]}. ${Number(m[2])}. ${Number(m[3])}.`;
  return val.trim();
}

function parseStatus(val: string): OrderStatus {
  return STATUS_MAP[val?.trim()] ?? "주문접수";
}

// CSV 행 파싱 (따옴표 처리 포함)
function parseRow(line: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuote = !inQuote;
    } else if (ch === ',' && !inQuote) {
      result.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  result.push(cur.trim());
  return result;
}

export interface CsvParseResult {
  orders: Order[];
  errors: string[];
  totalRows: number;
}

export function parseBuymaCSV(csvText: string): CsvParseResult {
  // BOM 제거
  const text = csvText.replace(/^﻿/, "");
  const lines = text.split(/\r?\n/).filter(l => l.trim());

  if (lines.length < 2) {
    return { orders: [], errors: ["데이터 행이 없습니다"], totalRows: 0 };
  }

  const headers = parseRow(lines[0]);
  const idx = {
    orderNumber:   findColIndex(headers, COL_CANDIDATES.orderNumber),
    orderDate:     findColIndex(headers, COL_CANDIDATES.orderDate),
    productName:   findColIndex(headers, COL_CANDIDATES.productName),
    buyerName:     findColIndex(headers, COL_CANDIDATES.buyerName),
    sellingPrice:  findColIndex(headers, COL_CANDIDATES.sellingPrice),
    status:        findColIndex(headers, COL_CANDIDATES.status),
    trackingNumber:findColIndex(headers, COL_CANDIDATES.trackingNumber),
  };

  if (idx.orderNumber < 0 && idx.productName < 0) {
    return {
      orders: [],
      errors: [
        "바이마 CSV 형식을 인식할 수 없습니다.",
        `감지된 헤더: ${headers.slice(0, 6).join(", ")}`,
      ],
      totalRows: 0,
    };
  }

  const orders: Order[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const row = parseRow(lines[i]);
    if (row.every(c => !c)) continue;

    const orderNumber = idx.orderNumber >= 0 ? row[idx.orderNumber] ?? "" : "";
    const productName = idx.productName >= 0 ? row[idx.productName] ?? "" : "";
    if (!orderNumber && !productName) continue;

    const sellingPrice = idx.sellingPrice >= 0 ? parsePrice(row[idx.sellingPrice] ?? "") : 0;
    const calc = calcMargin({
      sellingPrice,
      purchasePrice: 0,
      shippingCost: 0,
      exchangeRate: 10.5,
      buymaFeeRate: 5.4,
      vatRefundRate: 9.09,
    });

    orders.push({
      id: generateId(),
      orderNumber,
      productName,
      buyerName:     idx.buyerName >= 0     ? row[idx.buyerName] ?? ""      : "",
      sellingPrice,
      purchasePrice: 0,
      shippingCost:  0,
      exchangeRate:  10.5,
      status:        idx.status >= 0        ? parseStatus(row[idx.status])  : "주문접수",
      trackingNumber:idx.trackingNumber >= 0 ? row[idx.trackingNumber] ?? "" : "",
      orderDate:     idx.orderDate >= 0     ? parseDate(row[idx.orderDate]) : "",
      shippedDate:   "",
      settledDate:   "",
      marginJpy:      Math.round(calc.profitWithRefund),
      marginRate:     parseFloat(calc.marginWithRefund.toFixed(2)),
      notes:          "",
      shippingAddress: "",
      phone:          "",
    });
  }

  if (orders.length === 0 && errors.length === 0) {
    errors.push("파싱된 주문이 없습니다. 파일 내용을 확인해주세요.");
  }

  return { orders, errors, totalRows: lines.length - 1 };
}

export async function readFileText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const utf8 = new TextDecoder("utf-8").decode(buffer);
  if (!utf8.includes("�")) return utf8;
  // UTF-8 디코딩 실패 시 Shift-JIS 시도 (일본어 CSV 대응)
  try {
    return new TextDecoder("shift-jis").decode(buffer);
  } catch {
    return utf8;
  }
}

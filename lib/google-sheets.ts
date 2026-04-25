import { google } from "googleapis";
import type { SourcingItem, Order } from "./types";

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!email || !key) throw new Error("Google 서비스 계정 환경변수가 설정되지 않았습니다.");
  return new google.auth.GoogleAuth({
    credentials: { client_email: email, private_key: key },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

function getSheets() {
  const auth = getAuth();
  return google.sheets({ version: "v4", auth });
}

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID!;
const SOURCING_SHEET = "소싱리스트";
const ORDERS_SHEET = "주문내역";

const SOURCING_HEADERS = [
  "ID", "상품명", "카테고리", "브랜드", "한국구매가(KRW)", "바이마최저가(JPY)",
  "내판매가(JPY)", "경쟁자수", "상태", "환급포함마진율(%)", "환급제외마진율(%)",
  "배송비(KRW)", "환율(KRW/JPY)", "메모", "등록일",
];

const ORDERS_HEADERS = [
  "ID", "주문번호", "상품명", "구매자명", "판매가(JPY)", "매입가(KRW)",
  "배송비(KRW)", "환율", "상태", "운송장번호", "주문일", "발송일", "정산일",
  "마진(JPY)", "마진율(%)", "메모",
];

export async function ensureSheets() {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const existingSheets = res.data.sheets?.map((s) => s.properties?.title) ?? [];

  const toCreate = [];
  if (!existingSheets.includes(SOURCING_SHEET)) toCreate.push(SOURCING_SHEET);
  if (!existingSheets.includes(ORDERS_SHEET)) toCreate.push(ORDERS_SHEET);

  if (toCreate.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: toCreate.map((title) => ({
          addSheet: { properties: { title } },
        })),
      },
    });
    // 헤더 추가
    const values = [];
    if (toCreate.includes(SOURCING_SHEET)) {
      values.push({ range: `${SOURCING_SHEET}!A1`, values: [SOURCING_HEADERS] });
    }
    if (toCreate.includes(ORDERS_SHEET)) {
      values.push({ range: `${ORDERS_SHEET}!A1`, values: [ORDERS_HEADERS] });
    }
    if (values.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: { valueInputOption: "RAW", data: values },
      });
    }
  }
}

export async function getSourcingItems(): Promise<SourcingItem[]> {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SOURCING_SHEET}!A2:O`,
  });
  const rows = res.data.values ?? [];
  return rows.map((r) => ({
    id: r[0] ?? "",
    productName: r[1] ?? "",
    category: r[2] ?? "",
    brand: r[3] ?? "",
    koreaPurchasePrice: Number(r[4]) || 0,
    buymaLowestPrice: Number(r[5]) || 0,
    sellingPrice: Number(r[6]) || 0,
    competitorCount: Number(r[7]) || 0,
    status: (r[8] as SourcingItem["status"]) ?? "조사중",
    marginWithRefund: Number(r[9]) || 0,
    marginWithoutRefund: Number(r[10]) || 0,
    shippingCost: Number(r[11]) || 0,
    exchangeRate: Number(r[12]) || 0,
    notes: r[13] ?? "",
    createdAt: r[14] ?? "",
  }));
}

export async function upsertSourcingItem(item: SourcingItem) {
  const sheets = getSheets();
  const items = await getSourcingItems();
  const idx = items.findIndex((i) => i.id === item.id);
  const row = [
    item.id, item.productName, item.category, item.brand,
    item.koreaPurchasePrice, item.buymaLowestPrice, item.sellingPrice,
    item.competitorCount, item.status, item.marginWithRefund,
    item.marginWithoutRefund, item.shippingCost, item.exchangeRate,
    item.notes, item.createdAt,
  ];

  if (idx >= 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SOURCING_SHEET}!A${idx + 2}:O${idx + 2}`,
      valueInputOption: "RAW",
      requestBody: { values: [row] },
    });
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SOURCING_SHEET}!A:O`,
      valueInputOption: "RAW",
      requestBody: { values: [row] },
    });
  }
}

export async function deleteSourcingItem(id: string) {
  const sheets = getSheets();
  const items = await getSourcingItems();
  const idx = items.findIndex((i) => i.id === id);
  if (idx < 0) return;
  const sheetId = await getSheetId(SOURCING_SHEET);
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [{
        deleteDimension: {
          range: { sheetId, dimension: "ROWS", startIndex: idx + 1, endIndex: idx + 2 },
        },
      }],
    },
  });
}

export async function getOrders(): Promise<Order[]> {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${ORDERS_SHEET}!A2:P`,
  });
  const rows = res.data.values ?? [];
  return rows.map((r) => ({
    id: r[0] ?? "",
    orderNumber: r[1] ?? "",
    productName: r[2] ?? "",
    buyerName: r[3] ?? "",
    sellingPrice: Number(r[4]) || 0,
    purchasePrice: Number(r[5]) || 0,
    shippingCost: Number(r[6]) || 0,
    exchangeRate: Number(r[7]) || 0,
    status: (r[8] as Order["status"]) ?? "주문접수",
    trackingNumber: r[9] ?? "",
    orderDate: r[10] ?? "",
    shippedDate: r[11] ?? "",
    settledDate: r[12] ?? "",
    marginJpy: Number(r[13]) || 0,
    marginRate: Number(r[14]) || 0,
    notes: r[15] ?? "",
    shippingAddress: r[16] ?? "",
    phone: r[17] ?? "",
  }));
}

export async function upsertOrder(order: Order) {
  const sheets = getSheets();
  const orders = await getOrders();
  const idx = orders.findIndex((o) => o.id === order.id);
  const row = [
    order.id, order.orderNumber, order.productName, order.buyerName,
    order.sellingPrice, order.purchasePrice, order.shippingCost, order.exchangeRate,
    order.status, order.trackingNumber, order.orderDate, order.shippedDate,
    order.settledDate, order.marginJpy, order.marginRate, order.notes,
  ];

  if (idx >= 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${ORDERS_SHEET}!A${idx + 2}:P${idx + 2}`,
      valueInputOption: "RAW",
      requestBody: { values: [row] },
    });
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${ORDERS_SHEET}!A:P`,
      valueInputOption: "RAW",
      requestBody: { values: [row] },
    });
  }
}

async function getSheetId(title: string): Promise<number> {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheet = res.data.sheets?.find((s) => s.properties?.title === title);
  return sheet?.properties?.sheetId ?? 0;
}

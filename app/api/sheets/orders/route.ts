import { NextRequest, NextResponse } from "next/server";
import { getOrders, upsertOrder, ensureSheets } from "@/lib/google-sheets";
import type { Order } from "@/lib/types";

let localOrders: Order[] = [];
const USE_LOCAL = !process.env.GOOGLE_SPREADSHEET_ID;

export async function GET() {
  try {
    if (USE_LOCAL) {
      return NextResponse.json({ orders: localOrders });
    }
    const orders = await getOrders();
    return NextResponse.json({ orders });
  } catch (error) {
    console.error("Orders GET error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "주문 데이터 로드 실패" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const order: Order = await req.json();
    if (USE_LOCAL) {
      const idx = localOrders.findIndex((o) => o.id === order.id);
      if (idx >= 0) localOrders[idx] = order;
      else localOrders.push(order);
      return NextResponse.json({ success: true });
    }
    await ensureSheets();
    await upsertOrder(order);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Orders POST error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "주문 저장 실패" },
      { status: 500 }
    );
  }
}

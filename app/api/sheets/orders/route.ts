import { NextRequest, NextResponse } from "next/server";
import type { Order } from "@/lib/types";

let orders: Order[] = [];

export async function GET() {
  return NextResponse.json({ orders });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // 배치 임포트: { orders: Order[] }
    if (Array.isArray(body.orders)) {
      const incoming: Order[] = body.orders;
      const existingNums = new Set(orders.map(o => o.orderNumber).filter(Boolean));
      let added = 0;
      let skipped = 0;
      for (const order of incoming) {
        if (order.orderNumber && existingNums.has(order.orderNumber)) {
          skipped++;
        } else {
          orders.push(order);
          if (order.orderNumber) existingNums.add(order.orderNumber);
          added++;
        }
      }
      return NextResponse.json({ success: true, added, skipped });
    }

    // 단건 저장
    const order: Order = body;
    const idx = orders.findIndex((o) => o.id === order.id);
    if (idx >= 0) orders[idx] = order;
    else orders.push(order);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "저장 실패" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import type { Order } from "@/lib/types";

let orders: Order[] = [];

export async function GET() {
  return NextResponse.json({ orders });
}

export async function POST(req: NextRequest) {
  try {
    const order: Order = await req.json();
    const idx = orders.findIndex((o) => o.id === order.id);
    if (idx >= 0) orders[idx] = order;
    else orders.push(order);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "저장 실패" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import type { SourcingItem } from "@/lib/types";

let items: SourcingItem[] = [];

export async function GET() {
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  try {
    const item: SourcingItem = await req.json();
    const idx = items.findIndex((i) => i.id === item.id);
    if (idx >= 0) items[idx] = item;
    else items.push(item);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "저장 실패" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID 필요" }, { status: 400 });
  items = items.filter((i) => i.id !== id);
  return NextResponse.json({ success: true });
}

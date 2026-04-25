import { NextRequest, NextResponse } from "next/server";
import { getSourcingItems, upsertSourcingItem, deleteSourcingItem, ensureSheets } from "@/lib/google-sheets";
import type { SourcingItem } from "@/lib/types";

// 구글 시트 미설정 시 로컬 메모리 fallback (개발용)
let localItems: SourcingItem[] = [];
const USE_LOCAL = !process.env.GOOGLE_SPREADSHEET_ID;

export async function GET() {
  try {
    if (USE_LOCAL) {
      return NextResponse.json({ items: localItems });
    }
    const items = await getSourcingItems();
    return NextResponse.json({ items });
  } catch (error) {
    console.error("Sourcing GET error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "소싱 데이터 로드 실패" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const item: SourcingItem = await req.json();
    if (USE_LOCAL) {
      const idx = localItems.findIndex((i) => i.id === item.id);
      if (idx >= 0) localItems[idx] = item;
      else localItems.push(item);
      return NextResponse.json({ success: true });
    }
    await ensureSheets();
    await upsertSourcingItem(item);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Sourcing POST error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "소싱 저장 실패" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID 필요" }, { status: 400 });

    if (USE_LOCAL) {
      localItems = localItems.filter((i) => i.id !== id);
      return NextResponse.json({ success: true });
    }
    await deleteSourcingItem(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Sourcing DELETE error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "소싱 삭제 실패" },
      { status: 500 }
    );
  }
}

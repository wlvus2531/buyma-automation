/**
 * POST /api/products/thumbnail — 직접 제작한 썸네일(data URL) 저장
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: NextRequest) {
  try {
    const { id, thumbnail_made_url } = await req.json();
    if (!id || !thumbnail_made_url) {
      return NextResponse.json({ error: "id, thumbnail_made_url 필요" }, { status: 400 });
    }
    if (typeof thumbnail_made_url !== "string" || thumbnail_made_url.length > 500_000) {
      return NextResponse.json({ error: "이미지 데이터 크기 초과" }, { status: 400 });
    }
    const supabase = getAdminSupabase();
    const { error } = await supabase
      .from("products")
      .update({ thumbnail_made_url })
      .eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

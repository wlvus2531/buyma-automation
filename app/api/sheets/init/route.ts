import { NextResponse } from "next/server";
import { ensureSheets } from "@/lib/google-sheets";

export async function POST() {
  try {
    if (!process.env.GOOGLE_SPREADSHEET_ID) {
      return NextResponse.json(
        { error: "GOOGLE_SPREADSHEET_ID 환경변수가 설정되지 않았습니다." },
        { status: 400 }
      );
    }
    await ensureSheets();
    return NextResponse.json({ success: true, message: "시트 초기화 완료" });
  } catch (error) {
    console.error("Init sheets error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "시트 초기화 실패" },
      { status: 500 }
    );
  }
}

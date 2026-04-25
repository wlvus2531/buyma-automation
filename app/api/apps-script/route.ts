import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { scriptUrl, ...payload } = await req.json();

    if (!scriptUrl || typeof scriptUrl !== "string") {
      return NextResponse.json({ error: "Apps Script URL이 필요합니다" }, { status: 400 });
    }

    const scriptRes = await fetch(scriptUrl, {
      method: "POST",
      redirect: "follow",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const text = await scriptRes.text();
    try {
      return NextResponse.json(JSON.parse(text));
    } catch {
      return NextResponse.json(
        { error: `Apps Script 응답 파싱 오류: ${text.slice(0, 300)}` },
        { status: 502 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "요청 실패" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";

export async function GET() {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/JPY", {
      next: { revalidate: 3600 },
    });
    if (!res.ok) throw new Error(`API ${res.status}`);
    const data = await res.json();

    if (data.result !== "success") throw new Error("환율 API 실패");

    const krwPerJpy: number = data.rates?.KRW ?? 10.5;

    return NextResponse.json({
      krwPerJpy: parseFloat(krwPerJpy.toFixed(4)),
      lastUpdated: data.time_last_update_utc ?? new Date().toUTCString(),
      nextUpdate: data.time_next_update_utc ?? "",
    });
  } catch (err) {
    console.error("exchange-rate error:", err);
    return NextResponse.json(
      { error: "환율 조회 실패", krwPerJpy: 10.5, lastUpdated: "" },
      { status: 500 }
    );
  }
}

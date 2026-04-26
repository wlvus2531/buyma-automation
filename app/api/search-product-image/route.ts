import { NextRequest, NextResponse } from "next/server";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export async function POST(req: NextRequest) {
  let query: string;
  try {
    ({ query } = await req.json());
  } catch {
    return NextResponse.json({ imageUrl: null });
  }
  if (!query || typeof query !== "string") {
    return NextResponse.json({ imageUrl: null });
  }

  const searchUrl = `https://www.musinsa.com/search/musinsa/goods?q=${encodeURIComponent(query)}`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(searchUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "ko-KR,ko;q=0.9",
        "Cache-Control": "no-cache",
      },
    }).finally(() => clearTimeout(timer));

    if (!response.ok) return NextResponse.json({ imageUrl: null });

    const html = await response.text();

    const urls = [...html.matchAll(/https:\/\/image\.musinsa\.com\/[^\s"'<>\\]+/g)]
      .map((m) => m[0])
      .filter(
        (u) =>
          /\.(jpg|jpeg|png|webp)/i.test(u) &&
          !/(50x|75x|100x|200x|icon|badge|banner|logo)/i.test(u)
      );

    return NextResponse.json({ imageUrl: urls[0] ?? null });
  } catch {
    return NextResponse.json({ imageUrl: null });
  }
}

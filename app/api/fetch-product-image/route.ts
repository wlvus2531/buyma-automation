import { NextRequest, NextResponse } from "next/server";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function extractOgImage(html: string): string | null {
  const patterns = [
    /<meta\s+property="og:image"\s+content="([^"]+)"/i,
    /<meta\s+content="([^"]+)"\s+property="og:image"/i,
    /<meta\s+property='og:image'\s+content='([^']+)'/i,
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m?.[1]) return m[1];
  }
  return null;
}

function dedupeUrls(urls: string[]): string[] {
  return [...new Set(urls)].filter((u) => {
    try { new URL(u); return true; } catch { return false; }
  });
}

function extractMusinsaImages(html: string): string[] {
  // 1. __NEXT_DATA__ JSON에서 상품 이미지 추출
  const scriptMatch = html.match(
    /<script[^>]+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/
  );
  if (scriptMatch) {
    try {
      const data = JSON.parse(scriptMatch[1]);
      const pp = data?.props?.pageProps;

      // 다양한 경로 시도
      const candidates = [
        pp?.goodsDetail?.goodsImgList,
        pp?.product?.images,
        pp?.goodsInfo?.goodsImgList,
        pp?.initialState?.goods?.goodsImgList,
      ];
      for (const list of candidates) {
        if (Array.isArray(list) && list.length > 0) {
          const urls = list
            .map((img: Record<string, string>) =>
              img.original || img.imageUrl || img.url || img.src || img.image
            )
            .filter(Boolean) as string[];
          if (urls.length > 0) return dedupeUrls(urls).slice(0, 8);
        }
      }
    } catch { /* fall through */ }
  }

  // 2. HTML에서 직접 image.musinsa.com URL 추출 (고해상도만)
  const all = [...html.matchAll(/https:\/\/image\.musinsa\.com\/[^\s"'<>\\]+/g)]
    .map((m) => m[0])
    .filter(
      (u) =>
        /\.(jpg|jpeg|png|webp)/i.test(u) &&
        !/(50x|75x|100x|200x|icon|badge|logo)/i.test(u)
    );

  return dedupeUrls(all).slice(0, 8);
}

function extract29cmImages(html: string): string[] {
  const ogImage = extractOgImage(html);
  const cdnUrls = [...html.matchAll(/https:\/\/img\.29cm\.co\.kr\/[^\s"'<>\\]+/g)]
    .map((m) => m[0])
    .filter((u) => /\.(jpg|jpeg|png|webp)/i.test(u) && !/(thumb|icon|50|100)/i.test(u));

  return dedupeUrls([...(ogImage ? [ogImage] : []), ...cdnUrls]).slice(0, 8);
}

function extractEqlImages(html: string): string[] {
  const ogImage = extractOgImage(html);
  // EQL CDN 패턴
  const cdnUrls = [
    ...html.matchAll(/https:\/\/[^\s"'<>\\]*eql[^\s"'<>\\]*\.(jpg|jpeg|png|webp)/gi),
  ].map((m) => m[0]);

  return dedupeUrls([...(ogImage ? [ogImage] : []), ...cdnUrls]).slice(0, 8);
}

export async function POST(req: NextRequest) {
  let url: string;
  try {
    ({ url } = await req.json());
  } catch {
    return NextResponse.json({ error: "요청 파싱 실패" }, { status: 400 });
  }

  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "URL이 필요합니다." }, { status: 400 });
  }

  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return NextResponse.json({ error: "유효하지 않은 URL입니다." }, { status: 400 });
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8",
        "Cache-Control": "no-cache",
        Referer: `https://${hostname}/`,
      },
    }).finally(() => clearTimeout(timer));

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} — 사이트가 접근을 차단했을 수 있습니다.`);
    }

    const html = await response.text();
    let images: string[] = [];

    if (hostname.includes("musinsa.com")) {
      images = extractMusinsaImages(html);
    } else if (hostname.includes("29cm.co.kr")) {
      images = extract29cmImages(html);
    } else if (hostname.includes("eql.kr")) {
      images = extractEqlImages(html);
    } else {
      const og = extractOgImage(html);
      if (og) images = [og];
    }

    // 최종 og:image 폴백
    if (images.length === 0) {
      const og = extractOgImage(html);
      if (og) images = [og];
    }

    if (images.length === 0) {
      return NextResponse.json({
        images: [],
        mainImage: null,
        error: "이미지를 찾을 수 없습니다. URL을 확인하거나 직접 입력해 주세요.",
      });
    }

    return NextResponse.json({ images, mainImage: images[0] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "이미지 가져오기 실패";
    return NextResponse.json(
      { images: [], mainImage: null, error: msg },
      { status: 500 }
    );
  }
}

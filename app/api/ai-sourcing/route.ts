import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSeason } from "@/lib/utils";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { trends, category, budget, keywords, mode, existingItems } = await req.json();
    // mode: "morning" (공격적 신규) | "evening" (방어적 파생)

    const today = new Date();
    const season = getSeason(today);
    const month = today.getMonth() + 1;
    const isMorning = mode !== "evening";

    const modeGuide = isMorning
      ? `오늘 아침 소싱 세션 — 일본 트렌드·한류 기반 완전 신규 소싱 (공격적). 지금까지 소싱하지 않은 새로운 카테고리·브랜드를 발굴하세요.`
      : `오늘 저녁 소싱 세션 — 현재 소싱리스트 기반 파생·교체 추천 (방어적 관리). 기존 카테고리에서 교차 판매·업셀링 가능한 보완 상품을 추천하세요.\n현재 소싱 중인 상품: ${existingItems?.join(", ") || "없음"}`;

    const prompt = `당신은 바이마(BUYMA) 한국→일본 역직구 판매 전략 전문가입니다.
현재 날짜: ${today.toLocaleDateString("ko-KR")} (${month}월, ${season})
세션: ${modeGuide}
선택된 트렌드 방향: ${trends?.join(", ") || "한류 트렌드, 시즌 트렌드"}
카테고리 필터: ${category || "전체"}
예산 범위: ${budget || "제한 없음"}
참고 키워드/브랜드: ${keywords || "없음"}

일본 바이마 구매자들이 한국 셀러에게 구매하고 싶어하는 상품 5개를 추천해 주세요.

각 상품을 아래 JSON 형식으로만 응답해 주세요 (마크다운 코드블록 없이 JSON 배열만):
[
  {
    "rank": 1,
    "productName": "상품명 (한국어)",
    "japaneseName": "商品名 (일본어)",
    "category": "카테고리",
    "brand": "브랜드명",
    "koreanPriceRange": "한국 구매가 범위",
    "expectedSellingPrice": "예상 바이마 판매가",
    "competitionLevel": "낮음 또는 보통 또는 높음",
    "expectedMargin": "예상 마진율",
    "reason": "추천 이유 (3줄 이내로 간결하게)",
    "sourcingTip": "소싱 팁 (구매처, 주의사항)",
    "trend": "관련 트렌드 키워드",
    "confidence": 85
  }
]

confidence 기준 (0~100):
- 90+: 한류 아이돌 착용 확인, 일본 수요 폭발 예측, 경쟁 매우 낮음
- 80~89: 명확한 트렌드 근거, 마진 15%+ 예상, 일본 미입하
- 70~79: 가능성 있으나 시장 불확실성 존재
- 70 미만: 투기적 소싱, 리스크 높음

K-아이돌 착용 브랜드 (2026 인기): Thug Club(방탄·SKZ), SCULPTOR(아이브·여자아이들), Matin Kim(블랙핑크·뉴진스), LUV IS TRUE(세븐틴·TXT), THEAIRTOWN(르세라핌·IVE), ADLV(전 아이돌), COVERNAT(RM)
시즌: ${month}월 (${season}) 아이템을 우선 추천
경쟁 낮고 마진 높은 틈새 상품 우선, 일본 구하기 어려운 한국 특산 브랜드 선호`;

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 3000,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";

    let items;
    try {
      const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      items = JSON.parse(cleaned);
    } catch {
      const match = text.match(/\[[\s\S]*\]/);
      if (match) {
        items = JSON.parse(match[0]);
      } else {
        throw new Error("AI 응답을 파싱할 수 없습니다.");
      }
    }

    return NextResponse.json({ items, mode: isMorning ? "morning" : "evening" });
  } catch (error) {
    console.error("AI sourcing error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "AI 소싱 분석 실패" },
      { status: 500 }
    );
  }
}

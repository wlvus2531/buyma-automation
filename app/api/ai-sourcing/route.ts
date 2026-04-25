import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSeason } from "@/lib/utils";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { trends, category, budget, keywords } = await req.json();

    const today = new Date();
    const season = getSeason(today);
    const month = today.getMonth() + 1;

    const prompt = `당신은 바이마(BUYMA) 한국→일본 역직구 판매 전략 전문가입니다.
현재 날짜: ${today.toLocaleDateString("ko-KR")} (${month}월, ${season})
선택된 트렌드 방향: ${trends.join(", ")}
카테고리 필터: ${category}
예산 범위: ${budget || "제한 없음"}
참고 키워드/브랜드: ${keywords || "없음"}

일본 바이마 구매자들이 한국 셀러에게 구매하고 싶어하는 상품 10개를 추천해 주세요.

각 상품을 아래 JSON 형식으로만 응답해 주세요 (마크다운 코드블록 없이 JSON 배열만):
[
  {
    "rank": 1,
    "productName": "상품명 (한국어)",
    "japaneseName": "商品名 (일본어 - 일본 구매자가 검색할 키워드)",
    "category": "카테고리",
    "brand": "브랜드명 (없으면 빈 문자열)",
    "koreanPriceRange": "한국 구매가 범위 예: 15,000~25,000원",
    "expectedSellingPrice": "예상 바이마 판매가 예: ¥2,500~3,500",
    "competitionLevel": "낮음 또는 보통 또는 높음",
    "expectedMargin": "예상 마진율 예: 25~35%",
    "reason": "추천 이유 (한류트렌드/시즌성/파생기회 등 구체적으로)",
    "sourcingTip": "소싱 팁 (구매처, 주의사항 등)",
    "trend": "관련 트렌드 키워드"
  }
]

추천 기준:
- 한류 트렌드: 최근 인기 K-드라마/K-팝 관련 뷰티, 패션 아이템
- 시즌 트렌드: ${month}월 계절에 맞는 상품 (${season} 아이템)
- 파생 상품: 바이마에서 이미 잘 팔리는 카테고리의 관련/보완 상품
- 경쟁이 낮고 마진이 높은 틈새 상품 우선
- 일본에서 구하기 어렵거나 한국 특산 브랜드 선호`;

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";

    // JSON 파싱
    let items;
    try {
      // 코드블록 제거
      const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      items = JSON.parse(cleaned);
    } catch {
      // 배열 부분만 추출 시도
      const match = text.match(/\[[\s\S]*\]/);
      if (match) {
        items = JSON.parse(match[0]);
      } else {
        throw new Error("AI 응답을 파싱할 수 없습니다. 다시 시도해 주세요.");
      }
    }

    return NextResponse.json({ items });
  } catch (error) {
    console.error("AI sourcing error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "AI 소싱 분석 실패" },
      { status: 500 }
    );
  }
}

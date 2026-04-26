import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다." },
        { status: 500 }
      );
    }
    const client = new Anthropic({ apiKey });

    const {
      productName, brand, category, sellingPrice,
      buymaLowestPrice, koreaPurchasePrice, notes, competitorCount,
    } = await req.json();

    const prompt = `당신은 바이마(BUYMA) 일본 출품 전문가입니다. 아래 소싱 상품 정보를 바탕으로 실제 바이마에 등록할 수 있는 최적화된 출품 자료를 생성하세요.

상품명(한국어): ${productName}
브랜드: ${brand || "없음"}
카테고리: ${category || "패션/의류"}
내 판매가: ¥${sellingPrice || 0}
바이마 최저가: ¥${buymaLowestPrice || 0}
한국 매입가: ₩${koreaPurchasePrice || 0}
경쟁자 수: ${competitorCount || 0}명
메모/특이사항: ${notes || "없음"}

아래 JSON 형식으로만 응답하세요 (마크다운 코드블록 없이):
{
  "title": "바이마 상품 타이틀 (60자 이내, ★ 이모지 포함, 関税込み/日本未入荷/韓国大人気 등 핵심 키워드 포함, 브랜드명+상품유형+특징 구조)",
  "subtitle": "서브타이틀 / 검색 보조 키워드 (30자 이내)",
  "description": "상품 설명 전문 (일본어 존댓말. 아래 요소를 모두 포함할 것:\\n- 상품 특징 3~5줄\\n- 소재·사이즈 안내\\n- ご注文後3〜7営業日以内に発送 발송 안내\\n- 関税込み 관세 포함 명시\\n- 정품 보증 안내\\n- 섹션별 이모지 사용. \\n로 줄바꿈)",
  "checklist": {
    "recommendedCategory": "바이마 카테고리 추천 (예: レディース > トップス > Tシャツ)",
    "priceGuide": "가격 설정 가이드 1~2줄 (바이마 최저가 기준)",
    "purchaseDeadline": "구매 기한 (예: 2025/12/31)",
    "condition": "상품 컨디션 추천 (新品·未使用 등)",
    "tags": ["검색태그1", "검색태그2", "검색태그3", "검색태그4", "검색태그5"]
  },
  "sellerTip": "이 상품 판매 시 주의할 점·팁 2~3줄 (한국어)"
}`;

    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    const text = msg.content[0].type === "text" ? msg.content[0].text : "";
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    let result;
    try {
      result = JSON.parse(cleaned);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        result = JSON.parse(match[0]);
      } else {
        throw new Error("AI 응답 파싱 실패");
      }
    }

    return NextResponse.json({ result });
  } catch (err) {
    console.error("buyma-listing error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "생성 실패" },
      { status: 500 }
    );
  }
}

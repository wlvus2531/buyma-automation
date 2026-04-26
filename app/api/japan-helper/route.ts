import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;
    let prompt = "";
    let expectJson = false;

    if (action === "listing") {
      const { productName, brand, category, description, sizes, keywords } = body;
      expectJson = true;
      prompt = `당신은 바이마(BUYMA) 일본 판매 전문가입니다. 일본 구매자가 "이 쇼퍼한테 꼭 사고 싶다"고 느낄 수 있도록 최적화된 일본어 상품 등록 텍스트를 생성하세요.

상품명(한국어): ${productName}
브랜드: ${brand || "없음"}
카테고리: ${category || "패션"}
한국어 설명: ${description || "없음"}
사이즈 정보: ${sizes || "없음"}
포함할 추가 키워드: ${keywords?.join(", ") || "없음"}

아래 JSON 형식으로만 응답 (마크다운 코드블록 없이):
{
  "title": "★ 이모지 포함 최적화 타이틀 (60자 이내, 관련 이모지 1-2개, K-POPアイドル着用/韓国大人気/日本未入荷 등 핵심 키워드 포함)",
  "subtitle": "서브타이틀 / 검색 보조 키워드 (30자 이내)",
  "description": "상품 설명 전문 (일본어 존댓말. 소재, 사이즈, 착용감, 관세 안내, 발송 기간, 주의사항 포함. 섹션별 이모지 사용. \\n로 줄바꿈)",
  "searchKeywords": ["검색키1", "검색키2", "검색키3", "검색키4", "검색키5", "검색키6"],
  "tip": "이 상품 판매 팁 1-2줄 (한국어)"
}`;
    } else if (action === "customMessage") {
      const { situation, buyerName, productName, trackingNumber, isVip, inquiryType, details, brand } = body;
      const buyer = buyerName || "お客様";
      const sitMap: Record<string, string> = {
        orderThanks: `구매 직후 주문 감사 메시지. 구매자: ${buyer}, 상품: ${productName || ""}`,
        shipped: `발송 완료 알림. 구매자: ${buyer}, 상품: ${productName || ""}, OCS 운송장: ${trackingNumber || ""}`,
        arrived: `상품 도착 확인 및 BUYMA 결제 완료 요청. 구매자: ${buyer}, 상품: ${productName || ""}`,
        inquiry: `문의 답변. 구매자: ${buyer}, 문의유형: ${inquiryType || "일반"}, 내용: ${details || ""}`,
        vipThanks: `리피터(재구매) 감사 메시지. 구매자: ${buyer}, 이번 상품: ${productName || ""}`,
        vipNew: `VIP 고객 신상 알림. 구매자: ${buyer}, 신상품: ${productName || ""}, 브랜드: ${brand || details || ""}`,
        coupon: `리피터 특별 할인·혜택 안내. 구매자: ${buyer}`,
        apology: `불만·문제 사과 메시지. 구매자: ${buyer}, 상황: ${details || ""}`,
      };
      prompt = `당신은 바이마 한국→일본 역직구 셀러입니다.
상황: ${sitMap[situation] || situation}
${isVip ? "※ VIP 리피터 고객 — 특별한 감사 표현과 친근함을 더해주세요" : ""}

정중하고 따뜻한 일본어 존댓말로 메시지를 작성하세요.
이모지를 자연스럽게 사용하세요. 신뢰감과 친근함을 동시에 전달하세요.
메시지 본문만 출력하세요 (설명 없이).`;
    } else if (action === "sizeGuide") {
      const { sizeType, brand, measurements } = body;
      prompt = `바이마 일본 구매자를 위한 한국 의류 사이즈 가이드를 일본어로 생성하세요.

상품/브랜드: ${brand || "한국 브랜드"}
사이즈 타입: ${sizeType}
사이즈 정보: ${measurements || "S/M/L/XL"}

포함 내용:
1. 사이즈 변환표 (한국 표기 → 일본 표기, 실측 cm)
2. 사이즈 선택 가이드
3. 핏 설명 (타이트/레귤러/오버핏 등)
4. 측정 방법 안내

이모지를 사용해서 보기 좋게 작성하세요. 메시지 본문만 출력하세요.`;
    } else {
      return NextResponse.json({ error: "알 수 없는 action" }, { status: 400 });
    }

    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    const text = msg.content[0].type === "text" ? msg.content[0].text : "";

    if (expectJson) {
      const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      try {
        return NextResponse.json({ result: JSON.parse(cleaned) });
      } catch {
        const match = text.match(/\{[\s\S]*\}/);
        if (match) {
          try { return NextResponse.json({ result: JSON.parse(match[0]) }); } catch { /* fall through */ }
        }
        return NextResponse.json({ result: { title: text.split("\n")[0], subtitle: "", description: text, searchKeywords: [], tip: "" } });
      }
    }

    return NextResponse.json({ result: text });
  } catch (err) {
    console.error("japan-helper error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "생성 실패" }, { status: 500 });
  }
}

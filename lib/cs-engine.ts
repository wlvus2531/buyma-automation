/**
 * lib/cs-engine.ts — CS 자동 답변 생성 엔진
 * Claude Haiku로 고객 문의 분류 + 일본어 답변 초안 작성
 */

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

export type CSCategory = '배송' | '환불' | '상품문의' | '기타';

interface CSContext {
  orderStatus?: string;
  trackingNumber?: string;
  productName?: string;
  sellerName?: string;
}

interface CSReplyResult {
  category: CSCategory;
  reply: string;
  summary_kr: string; // 운영자용 요약 (한국어)
}

// ──────────────────────────────────────────────
// 메인: CS 답변 생성
// ──────────────────────────────────────────────
export async function generateCSReply(
  customerMessage: string,
  context?: CSContext
): Promise<CSReplyResult> {
  const contextSection = context
    ? `\n\n[주문 정보]\n${[
        context.productName   ? `상품명: ${context.productName}` : '',
        context.orderStatus   ? `주문 상태: ${context.orderStatus}` : '',
        context.trackingNumber ? `운송장 번호: ${context.trackingNumber}` : '',
        context.sellerName    ? `셀러명: ${context.sellerName}` : '',
      ].filter(Boolean).join('\n')}`
    : '';

  const prompt = `당신은 BUYMA(일본 패션 C2C 플랫폼)의 한국인 셀러를 위한 CS 어시스턴트입니다.
고객이 일본어로 문의를 보냈습니다. 아래 지시에 따라 응답해주세요.

[고객 문의]
${customerMessage}
${contextSection}

지시사항:
1. 카테고리 분류: "배송" / "환불" / "상품문의" / "기타" 중 하나
2. 일본어 답변 초안 작성 (정중한 경어 사용, 200자 내외)
3. 운영자용 한국어 요약 (한 줄)

반드시 아래 JSON 형식으로만 응답하세요:
{
  "category": "배송",
  "reply": "いつもBUYMAをご利用いただき...",
  "summary_kr": "고객이 배송 상태를 문의함"
}`;

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = (response.content[0] as { type: string; text: string }).text;
    const jsonMatch = raw.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) throw new Error('JSON 파싱 실패');

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      category: validateCategory(parsed.category),
      reply: parsed.reply || '申し訳ございませんが、ただいま確認中です。',
      summary_kr: parsed.summary_kr || '문의 내용 확인 중',
    };
  } catch (e) {
    console.error('[cs-engine] generateCSReply 실패', e);
    return {
      category: '기타',
      reply: 'お問い合わせいただきありがとうございます。内容を確認の上、折り返しご連絡いたします。',
      summary_kr: 'AI 생성 실패 — 수동으로 답변해주세요',
    };
  }
}

// ──────────────────────────────────────────────
// 일괄 처리: pending 스레드에 AI 답변 생성
// ──────────────────────────────────────────────
export async function runDailyCSBatch(supabase: ReturnType<typeof import('@/lib/supabase').createServerSupabase> extends Promise<infer T> ? T : never) {
  const { data: threads } = await supabase
    .from('cs_threads')
    .select('id, customer_message, order_id, category')
    .eq('status', 'pending')
    .is('ai_reply', null)
    .limit(20);

  if (!threads?.length) return { processed: 0 };

  let processed = 0;
  for (const thread of threads) {
    try {
      await supabase
        .from('cs_threads')
        .update({ status: 'generating' })
        .eq('id', thread.id);

      const result = await generateCSReply(thread.customer_message);

      await supabase
        .from('cs_threads')
        .update({
          ai_reply: result.reply,
          category: result.category,
          status: 'pending', // 운영자 검토 대기
        })
        .eq('id', thread.id);

      processed++;
    } catch (e) {
      console.error(`[cs-engine] thread ${thread.id} 실패`, e);
      await supabase.from('cs_threads').update({ status: 'pending' }).eq('id', thread.id);
    }
  }

  return { processed };
}

function validateCategory(cat: string): CSCategory {
  const valid: CSCategory[] = ['배송', '환불', '상품문의', '기타'];
  return valid.includes(cat as CSCategory) ? (cat as CSCategory) : '기타';
}

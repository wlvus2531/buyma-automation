/**
 * POST /api/approvals/push
 * 운영자가 승인 요청 생성 시 사장님에게 푸시 발송
 *
 * 채널 (우선순위):
 *  1. Web Push (PWA, 가장 빠름) — 사장님이 push_endpoint 등록한 경우
 *  2. Discord Webhook — 항상 작동 (백업)
 *  3. Email — 4시간 이상 미응답 시 (TODO)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase';

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

export async function POST(req: NextRequest) {
  try {
    const { approval_id } = await req.json();
    if (!approval_id) {
      return NextResponse.json({ error: 'approval_id 필요' }, { status: 400 });
    }

    const supabase = await createServerSupabase();
    const { data: approval, error } = await supabase
      .from('approvals')
      .select('*, requester:users!approvals_requested_by_fkey(name, avatar_emoji)')
      .eq('id', approval_id)
      .single();

    if (error || !approval) {
      return NextResponse.json({ error: '승인 요청 없음' }, { status: 404 });
    }

    // 사장님 사용자 조회 (push_endpoint 보유)
    const { data: owners } = await supabase
      .from('users')
      .select('*')
      .eq('role', 'owner')
      .eq('is_active', true);

    const results = {
      web_push: 0,
      discord: 0,
    };

    // 1. Web Push (PWA 구독한 사장님에게)
    for (const owner of owners || []) {
      if (owner.push_endpoint && owner.push_keys) {
        try {
          await sendWebPush(owner, approval);
          results.web_push++;
        } catch (e) {
          console.error('Web Push 실패', e);
        }
      }
    }

    // 2. Discord Webhook (백업)
    if (DISCORD_WEBHOOK_URL) {
      try {
        await sendDiscord(approval);
        results.discord++;
      } catch (e) {
        console.error('Discord 실패', e);
      }
    }

    // 발송 시각 기록
    await supabase
      .from('approvals')
      .update({ pushed_at: new Date().toISOString() })
      .eq('id', approval_id);

    return NextResponse.json({ ok: true, ...results });
  } catch (e) {
    console.error('push error', e);
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}

// =====================================================
// Web Push 발송 (web-push 라이브러리 필요)
// =====================================================
async function sendWebPush(owner: any, approval: any) {
  // npm install web-push 후 사용
  // 환경변수: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
  // 실제 구현 시 web-push 패키지로 발송
  // 이 예제에서는 인터페이스만 정의

  const payload = JSON.stringify({
    title: '승인 대기',
    body: `${approval.target_label} · ${approval.rule_violated || '확인 필요'}`,
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    data: {
      approval_id: approval.id,
      url: `/owner/approve?id=${approval.id}`,
    },
    actions: [
      { action: 'approve', title: '✅ 승인' },
      { action: 'reject', title: '❌ 거부' },
    ],
  });

  // 실제 운영 코드:
  // import webpush from 'web-push';
  // webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  // await webpush.sendNotification(
  //   { endpoint: owner.push_endpoint, keys: owner.push_keys },
  //   payload
  // );

  console.log('Web Push 발송:', owner.name, payload);
}

// =====================================================
// Discord Webhook 발송
// =====================================================
async function sendDiscord(approval: any) {
  if (!DISCORD_WEBHOOK_URL) return;

  const proposed = approval.proposed_value || {};
  const requester = approval.requester?.name || '운영자';

  const embed = {
    title: `📌 승인 대기: ${approval.target_label}`,
    description: approval.rule_violated || '확인 필요',
    color: 0xf59e0b, // amber
    fields: [
      { name: '요청자', value: requester, inline: true },
      { name: '유형', value: labelOfType(approval.request_type), inline: true },
      ...(proposed.price_jpy
        ? [{ name: '제안 가격', value: `¥${proposed.price_jpy.toLocaleString()}`, inline: true }]
        : []),
      ...(proposed.margin_pct
        ? [{ name: '예상 마진', value: `${proposed.margin_pct}%`, inline: true }]
        : []),
      ...(approval.note
        ? [{ name: '메모', value: approval.note }]
        : []),
    ],
    footer: {
      text: `ID: ${approval.id}`,
    },
    timestamp: approval.created_at,
  };

  const url =
    process.env.NEXT_PUBLIC_SITE_URL || 'https://your-app.vercel.app';
  const approvalUrl = `${url}/owner/approve?id=${approval.id}`;

  await fetch(DISCORD_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: `<@everyone> 승인 대기 1건 · [모바일에서 결정](${approvalUrl})`,
      embeds: [embed],
    }),
  });
}

function labelOfType(t: string): string {
  const map: Record<string, string> = {
    price_below_margin: '마진 부족',
    price_high_unit: '고가 상품',
    new_category: '신규 카테고리',
    refund: '환불 요청',
    large_price_drop: '큰 가격 변동',
    owner_to_operator: '사장님 지시',
  };
  return map[t] || t;
}

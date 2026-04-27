/**
 * <ApprovalQueuePanel />
 * 사장님 승인 대기 중인 항목들 표시
 *
 * - 운영자 모드: 자기가 요청한 거 + 재촉 버튼
 * - 사장님 모드: 승인/거부 버튼
 */

'use client';

import { useState } from 'react';
import { useApprovals } from '@/hooks/useApprovals';
import type { UserRole, ApprovalWithUser } from '@/types';

interface Props {
  currentUserId: string | null;
  currentUserRole: UserRole;
}

export function ApprovalQueuePanel({ currentUserId, currentUserRole }: Props) {
  const { pending, approve, reject } = useApprovals();

  return (
    <section className="rounded-2xl bg-stone-900 text-white p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold uppercase tracking-wider">
          📌 사장님 승인 대기
        </h3>
        <span className="text-xs bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full">
          {pending.length}건
        </span>
      </div>
      {pending.length === 0 ? (
        <div className="text-xs text-stone-400 py-4 text-center">대기 중인 항목 없음</div>
      ) : (
        <div className="space-y-2">
          {pending.map((a) => (
            <ApprovalCard
              key={a.id}
              approval={a}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
              onApprove={(value, note) =>
                currentUserId && approve(a.id, currentUserId, { decided_value: value, decision_note: note })
              }
              onReject={(note) =>
                currentUserId && reject(a.id, currentUserId, note)
              }
            />
          ))}
        </div>
      )}
    </section>
  );
}

function ApprovalCard({
  approval: a,
  currentUserRole,
  onApprove,
  onReject,
}: {
  approval: ApprovalWithUser;
  currentUserId: string | null;
  currentUserRole: UserRole;
  onApprove: (value?: Record<string, unknown>, note?: string) => void;
  onReject: (note?: string) => void;
}) {
  const minutesAgo = Math.floor(
    (Date.now() - new Date(a.created_at).getTime()) / 60000
  );
  const waitLabel = minutesAgo < 60 ? `${minutesAgo}분 대기` : `${Math.floor(minutesAgo / 60)}시간 ${minutesAgo % 60}분 대기`;

  const proposed = a.proposed_value as Record<string, any> | null;

  return (
    <div className="bg-white/10 rounded-lg p-3">
      <div className="text-sm font-medium mb-1">{a.target_label}</div>
      <div className="text-xs text-stone-300 mb-2">
        {a.rule_violated || labelOfType(a.request_type)}
        {proposed && proposed.price_jpy && (
          <span> · ¥{proposed.price_jpy.toLocaleString()}</span>
        )}
        {proposed && proposed.margin_pct && (
          <span> · 마진 {proposed.margin_pct}%</span>
        )}
      </div>
      {a.note && (
        <div className="text-[11px] text-stone-400 italic mb-2">"{a.note}"</div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-[10px] text-amber-300">⏰ {waitLabel}</span>

        {currentUserRole === 'owner' ? (
          <div className="flex gap-1">
            <button
              onClick={() => onApprove()}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] px-2 py-1 rounded font-bold"
            >
              ✅ 승인
            </button>
            <button
              onClick={() => onReject()}
              className="bg-red-600/70 hover:bg-red-600 text-white text-[10px] px-2 py-1 rounded font-bold"
            >
              ❌ 거부
            </button>
          </div>
        ) : (
          <button className="bg-white/20 hover:bg-white/30 px-2 py-1 rounded text-[10px]">
            재촉 푸시
          </button>
        )}
      </div>
    </div>
  );
}

function labelOfType(t: string) {
  switch (t) {
    case 'price_below_margin': return '마진 부족';
    case 'price_high_unit': return '고가 상품';
    case 'new_category': return '신규 카테고리';
    case 'refund': return '환불 요청';
    case 'large_price_drop': return '큰 가격 변동';
    case 'owner_to_operator': return '사장님 지시';
    default: return t;
  }
}

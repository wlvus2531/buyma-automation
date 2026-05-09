/**
 * useApprovals
 * 승인 큐 실시간 구독 + 승인/거부 액션
 *
 * 운영자: 자기가 요청한 것 보기 (대기 중인 거 재촉, 결과 확인)
 * 사장님: 모든 pending 보기 (승인/거부)
 *
 * 사용:
 *   const { pending, approve, reject, requestApproval } = useApprovals();
 */

'use client';

import { useEffect, useState } from 'react';
import { createBrowserSupabase } from '@/lib/supabase';
import type {
  Approval,
  ApprovalRequestType,
  ApprovalWithUser,
} from '@/types';

export function useApprovals() {
  const [pending, setPending] = useState<ApprovalWithUser[]>([]);
  const [recent, setRecent] = useState<ApprovalWithUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const supabase = createBrowserSupabase();
    let isMounted = true;

    async function loadAll() {
      const [pendingRes, recentRes] = await Promise.all([
        supabase
          .from('approvals')
          .select('*, requester:users!approvals_requested_by_fkey(name, avatar_emoji, role)')
          .eq('status', 'pending')
          .order('created_at', { ascending: true }),
        supabase
          .from('approvals')
          .select('*, decider:users!approvals_decided_by_fkey(name, avatar_emoji, role)')
          .neq('status', 'pending')
          .order('decided_at', { ascending: false })
          .limit(10),
      ]);

      if (!isMounted) return;
      if (pendingRes.data) setPending(pendingRes.data as ApprovalWithUser[]);
      if (recentRes.data) setRecent(recentRes.data as ApprovalWithUser[]);
      setIsLoading(false);
    }

    loadAll();

    // 실시간 구독 (유니크 채널명 — 같은 페이지에서 여러번 사용 시 충돌 방지)
    const channel = supabase
      .channel(`approvals:stream:${Math.random().toString(36).slice(2, 10)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'approvals' },
        () => {
          // 변경 발생 시 전체 리프레시 (단순화)
          loadAll();
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  /** 운영자가 승인 요청 생성 */
  async function requestApproval(input: {
    request_type: ApprovalRequestType;
    target_type?: string;
    target_id?: string;
    target_label: string;
    details: Record<string, unknown>;
    proposed_value?: Record<string, unknown>;
    rule_violated?: string;
    note?: string;
    requested_by: string;
  }): Promise<Approval | null> {
    const supabase = createBrowserSupabase();
    const { data, error } = await supabase
      .from('approvals')
      .insert(input)
      .select()
      .single();

    if (error) {
      console.error('requestApproval error', error);
      return null;
    }

    // 사장님에게 푸시 (백엔드 API)
    fetch('/api/approvals/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approval_id: data.id }),
    }).catch(() => {/* 푸시 실패는 비차단 */});

    return data as Approval;
  }

  /** 사장님이 승인 */
  async function approve(
    approvalId: string,
    deciderId: string,
    options?: { decided_value?: Record<string, unknown>; decision_note?: string }
  ) {
    const supabase = createBrowserSupabase();
    const { error } = await supabase
      .from('approvals')
      .update({
        status: 'approved',
        decided_by: deciderId,
        decided_at: new Date().toISOString(),
        decided_value: options?.decided_value || null,
        decision_note: options?.decision_note || null,
      })
      .eq('id', approvalId);

    if (error) console.error('approve error', error);
  }

  /** 사장님이 거부 */
  async function reject(
    approvalId: string,
    deciderId: string,
    note?: string
  ) {
    const supabase = createBrowserSupabase();
    const { error } = await supabase
      .from('approvals')
      .update({
        status: 'rejected',
        decided_by: deciderId,
        decided_at: new Date().toISOString(),
        decision_note: note || null,
      })
      .eq('id', approvalId);

    if (error) console.error('reject error', error);
  }

  return { pending, recent, isLoading, requestApproval, approve, reject };
}

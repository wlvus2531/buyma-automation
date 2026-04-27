/**
 * useWorkLock
 * 한 리소스(상품/주문)를 한 명만 작업할 수 있게 잠금
 *
 * 핵심 동작:
 *  - acquire: 잠금 획득 시도. 다른 사람이 이미 잡았으면 false 반환.
 *  - release: 잠금 해제.
 *  - heartbeat: 1분마다 expires_at 갱신 (작업 중 표시).
 *  - 자동 만료: 5분 idle 시 DB 트리거가 청소.
 *
 * 사용:
 *   const { acquire, release, currentLock, lockOwner } = useWorkLock('product', productId);
 */

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createBrowserSupabase } from '@/lib/supabase';
import type { WorkLock, ResourceType, User } from '@/types';

interface LockState {
  lock: WorkLock | null;
  owner: Pick<User, 'id' | 'name' | 'avatar_emoji'> | null;
  isOwnedByMe: boolean;
}

export function useWorkLock(
  resourceType: ResourceType,
  resourceId: string | null,
  currentUserId: string | null
) {
  const [state, setState] = useState<LockState>({
    lock: null,
    owner: null,
    isOwnedByMe: false,
  });
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);

  // 현재 잠금 상태 조회 + 실시간 구독
  useEffect(() => {
    if (!resourceId) {
      setState({ lock: null, owner: null, isOwnedByMe: false });
      return;
    }

    const supabase = createBrowserSupabase();
    let isMounted = true;

    async function refresh() {
      const { data: lockData } = await supabase
        .from('work_locks')
        .select('*, owner:users!work_locks_user_id_fkey(id, name, avatar_emoji)')
        .eq('resource_type', resourceType)
        .eq('resource_id', resourceId)
        .maybeSingle();

      if (!isMounted) return;

      if (!lockData) {
        setState({ lock: null, owner: null, isOwnedByMe: false });
        return;
      }

      const lock = lockData as WorkLock & { owner: any };
      setState({
        lock,
        owner: lock.owner || null,
        isOwnedByMe: lock.user_id === currentUserId,
      });
    }

    refresh();

    // 실시간 — 같은 리소스 잠금 변동 감지
    const channel = supabase
      .channel(`work_locks:${resourceType}:${resourceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'work_locks',
          filter: `resource_id=eq.${resourceId}`,
        },
        () => refresh()
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [resourceType, resourceId, currentUserId]);

  /** 잠금 획득 */
  const acquire = useCallback(async (): Promise<boolean> => {
    if (!resourceId || !currentUserId) return false;
    const supabase = createBrowserSupabase();

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('work_locks')
      .upsert(
        {
          resource_type: resourceType,
          resource_id: resourceId,
          user_id: currentUserId,
          acquired_at: new Date().toISOString(),
          expires_at: expiresAt,
        },
        { onConflict: 'resource_type,resource_id', ignoreDuplicates: false }
      )
      .select()
      .single();

    if (error || !data) {
      // 이미 다른 사람이 잡고 있음
      return false;
    }

    if (data.user_id !== currentUserId) {
      return false;
    }

    // 하트비트 시작 (1분마다 expires_at 연장)
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    heartbeatRef.current = setInterval(async () => {
      const newExpires = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      await supabase
        .from('work_locks')
        .update({ expires_at: newExpires })
        .eq('resource_type', resourceType)
        .eq('resource_id', resourceId)
        .eq('user_id', currentUserId);
    }, 60 * 1000);

    return true;
  }, [resourceType, resourceId, currentUserId]);

  /** 잠금 해제 */
  const release = useCallback(async () => {
    if (!resourceId || !currentUserId) return;
    const supabase = createBrowserSupabase();

    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }

    await supabase
      .from('work_locks')
      .delete()
      .eq('resource_type', resourceType)
      .eq('resource_id', resourceId)
      .eq('user_id', currentUserId);
  }, [resourceType, resourceId, currentUserId]);

  /** 진행 단계 저장 (워크플로우 중단 시 자동 복원용) */
  const saveStep = useCallback(
    async (step: number, stepData: Record<string, unknown>) => {
      if (!resourceId || !currentUserId || !state.isOwnedByMe) return;
      const supabase = createBrowserSupabase();
      await supabase
        .from('work_locks')
        .update({ current_step: step, step_data: stepData })
        .eq('resource_type', resourceType)
        .eq('resource_id', resourceId)
        .eq('user_id', currentUserId);
    },
    [resourceType, resourceId, currentUserId, state.isOwnedByMe]
  );

  // 컴포넌트 unmount 시 자동 해제
  useEffect(() => {
    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, []);

  return {
    ...state,
    acquire,
    release,
    saveStep,
  };
}

/**
 * useRealtimePresence
 * 누가 지금 어디 화면을 보고 있는지 실시간 추적
 *
 * 동작:
 *  - 컴포넌트 마운트 시 자기 세션 기록 (current_screen)
 *  - 30초마다 last_seen 갱신
 *  - 다른 사용자 세션을 실시간 구독
 *  - 90초+ idle은 자동 오프라인 처리
 *
 * 사용:
 *   const { onlineUsers, viewersOfResource } = useRealtimePresence({
 *     userId, currentScreen: '/today', currentResourceId: null
 *   });
 */

'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { createBrowserSupabase } from '@/lib/supabase';
import type { PresenceUser, Device } from '@/types';

interface Options {
  userId: string | null;
  currentScreen: string;
  currentResourceId?: string | null;
  device?: Device;
}

export function useRealtimePresence({
  userId,
  currentScreen,
  currentResourceId = null,
  device = 'pc',
}: Options) {
  const [sessions, setSessions] = useState<PresenceUser[]>([]);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);

  // 자기 세션 등록 + 하트비트
  useEffect(() => {
    if (!userId) return;
    const supabase = createBrowserSupabase();
    let isMounted = true;

    async function upsertSession() {
      await supabase.from('user_sessions').upsert({
        user_id: userId,
        current_screen: currentScreen,
        current_resource_id: currentResourceId,
        device,
        last_seen: new Date().toISOString(),
      });
    }

    upsertSession();

    // 30초마다 갱신
    heartbeatRef.current = setInterval(upsertSession, 30 * 1000);

    return () => {
      isMounted = false;
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      // unmount 시 본인 세션 삭제 (선택)
      supabase.from('user_sessions').delete().eq('user_id', userId);
    };
  }, [userId, currentScreen, currentResourceId, device]);

  // 모든 사용자 세션 실시간 구독
  useEffect(() => {
    const supabase = createBrowserSupabase();
    let isMounted = true;

    async function refresh() {
      const cutoff = new Date(Date.now() - 90 * 1000).toISOString();
      const { data } = await supabase
        .from('user_sessions')
        .select('*, user:users(id, name, role, avatar_emoji)')
        .gte('last_seen', cutoff);

      if (isMounted && data) {
        setSessions(data as unknown as PresenceUser[]);
      }
    }

    refresh();

    const channel = supabase
      .channel(`user_sessions:presence:${Math.random().toString(36).slice(2, 10)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_sessions' },
        () => refresh()
      )
      .subscribe();

    // 60초마다 90s+ idle 정리 (선택)
    const cleanInterval = setInterval(refresh, 60 * 1000);

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
      clearInterval(cleanInterval);
    };
  }, []);

  /** 나 제외 온라인 사용자 */
  const onlineUsers = useMemo(
    () => sessions.filter((s) => s.user_id !== userId),
    [sessions, userId]
  );

  /** 특정 리소스를 보고 있는 사람 */
  function viewersOfResource(resourceId: string) {
    return onlineUsers.filter((s) => s.current_resource_id === resourceId);
  }

  /** 특정 화면을 보고 있는 사람 */
  function viewersOfScreen(screen: string) {
    return onlineUsers.filter((s) => s.current_screen === screen);
  }

  return { sessions, onlineUsers, viewersOfResource, viewersOfScreen };
}

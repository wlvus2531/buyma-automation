/**
 * useActivityFeed
 * 활동 피드 실시간 구독 + 최근 N개 자동 유지
 *
 * 사용:
 *   const { items, isLoading } = useActivityFeed(20);
 */

'use client';

import { useEffect, useState } from 'react';
import { createBrowserSupabase } from '@/lib/supabase';
import type { ActivityFeedItem } from '@/types';

export function useActivityFeed(limit: number = 20) {
  const [items, setItems] = useState<ActivityFeedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const supabase = createBrowserSupabase();
    let isMounted = true;

    // 초기 로드
    (async () => {
      const { data, error } = await supabase
        .from('activity_feed')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (!isMounted) return;
      if (error) {
        console.error('activity_feed load error', error);
      } else if (data) {
        setItems(data as ActivityFeedItem[]);
      }
      setIsLoading(false);
    })();

    // 실시간 구독 — 새 활동 추가 시 맨 앞에 삽입
    const channel = supabase
      .channel('activity_feed:stream')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'activity_feed' },
        (payload) => {
          const next = payload.new as ActivityFeedItem;
          setItems((prev) => [next, ...prev].slice(0, limit));
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [limit]);

  /** 새 활동 기록 (어디서든 호출 가능한 헬퍼) */
  async function logActivity(input: {
    actor_label: string;
    action_type: string;
    target_label?: string;
    target_type?: string;
    target_id?: string;
    user_id?: string;
    details?: Record<string, unknown>;
  }) {
    const supabase = createBrowserSupabase();
    const { error } = await supabase.from('activity_feed').insert(input);
    if (error) console.error('logActivity error', error);
  }

  return { items, isLoading, logActivity };
}

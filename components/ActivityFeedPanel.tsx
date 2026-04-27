/**
 * <ActivityFeedPanel />
 * 트위터처럼 흐르는 실시간 활동 로그
 */

'use client';

import { useActivityFeed } from '@/hooks/useActivityFeed';
import type { ActivityFeedItem } from '@/types';

export function ActivityFeedPanel({ limit = 20 }: { limit?: number }) {
  const { items, isLoading } = useActivityFeed(limit);

  return (
    <section className="rounded-2xl bg-white border border-stone-200 p-4">
      <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700 mb-3 flex items-center gap-2">
        📜 활동 피드
        <span className="text-stone-400 font-normal text-[10px] normal-case">실시간</span>
      </h3>

      {isLoading ? (
        <div className="text-xs text-stone-400 py-4 text-center">불러오는 중...</div>
      ) : items.length === 0 ? (
        <div className="text-xs text-stone-400 py-4 text-center">아직 활동 없음</div>
      ) : (
        <div className="space-y-3 text-xs max-h-96 overflow-y-auto">
          {items.map((item, i) => (
            <FeedRow key={item.id} item={item} isLatest={i === 0} />
          ))}
        </div>
      )}
    </section>
  );
}

function FeedRow({ item, isLatest }: { item: ActivityFeedItem; isLatest: boolean }) {
  const timeLabel = relativeTime(item.created_at);
  const actorColor = colorOfActor(item.actor_label);

  return (
    <div className={`flex gap-2 ${isLatest ? 'slide-in' : ''}`}>
      <span className="text-stone-400 tabular-nums shrink-0 w-12">{timeLabel}</span>
      <div className="flex-1 min-w-0">
        <div>
          <span className={`font-semibold ${actorColor}`}>{item.actor_label}</span>{' '}
          <span>{labelOfAction(item.action_type)}</span>
        </div>
        {item.target_label && (
          <div className="text-stone-500 truncate">{item.target_label}</div>
        )}
      </div>
    </div>
  );
}

function colorOfActor(label: string) {
  if (label === 'AI' || label === '시스템') return 'text-stone-500';
  if (label === '사장' || label === '사장님') return 'text-amber-700';
  return '';
}

function labelOfAction(action: string): string {
  const map: Record<string, string> = {
    sourcing_extracted: '소싱 후보 추출 완료',
    sourcing_ok: '소싱 OK 클릭',
    sourcing_ng: '소싱 거부',
    register_start: '등록 시작',
    register_complete: '등록 완료',
    price_approved: '가격 승인 ✅',
    price_rejected: '가격 거부 ❌',
    approval_requested: '승인 요청',
    order_placed: '한국몰 발주',
    cs_replied: 'CS 답변 전송',
    price_alert: '가격 알림',
    stock_alert: '재고 알림',
    monitor_scan: '자동 스캔 완료',
  };
  return map[action] || action;
}

function relativeTime(iso: string): string {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 30) return '지금';
  if (sec < 60) return `${sec}초 전`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  return `${day}일 전`;
}

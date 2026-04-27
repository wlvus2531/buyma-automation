/**
 * <PresencePanel />
 * 지금 누가 어디서 무엇을 하고 있는지 실시간 표시
 */

'use client';

import { useRealtimePresence } from '@/hooks/useRealtimePresence';
import type { PresenceUser } from '@/types';

interface Props {
  currentUserId: string | null;
  currentScreen: string;
  currentResourceId?: string | null;
}

export function PresencePanel({
  currentUserId,
  currentScreen,
  currentResourceId,
}: Props) {
  const { onlineUsers, sessions } = useRealtimePresence({
    userId: currentUserId,
    currentScreen,
    currentResourceId: currentResourceId ?? null,
    device: 'pc',
  });

  const me = sessions.find((s) => s.user_id === currentUserId);
  const total = onlineUsers.length + (me ? 1 : 0);

  return (
    <section className="rounded-2xl bg-white border border-stone-200 p-4">
      <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700 mb-3 flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        지금 접속 중 ({total}명)
      </h3>
      <div className="space-y-2">
        {me && <UserRow session={me} isMe />}
        {onlineUsers.map((s) => (
          <UserRow key={s.user_id} session={s} />
        ))}
        {total === 0 && (
          <div className="text-xs text-stone-500">접속자 없음</div>
        )}
      </div>
    </section>
  );
}

function UserRow({ session, isMe = false }: { session: PresenceUser; isMe?: boolean }) {
  const u = session.user;
  if (!u) return null;

  const screenLabel = labelOfScreen(session.current_screen);
  const deviceIcon = session.device === 'mobile' ? '📱' : '💻';

  return (
    <div className="flex items-center gap-2 text-sm">
      <div className="w-7 h-7 rounded-full bg-stone-200 flex items-center justify-center text-sm">
        {u.avatar_emoji}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium truncate">
          {u.name}
          {isMe && <span className="text-stone-400 ml-1">(나)</span>}
        </div>
        <div className="text-[10px] text-stone-500 flex items-center gap-1">
          {deviceIcon} {screenLabel}
        </div>
      </div>
      {u.role === 'owner' && (
        <span className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold">
          OWNER
        </span>
      )}
    </div>
  );
}

function labelOfScreen(screen: string | null): string {
  if (!screen) return '대기 중';
  if (screen.startsWith('/today')) return '오늘 할 일';
  if (screen.startsWith('/sourcing')) return '소싱 결정';
  if (screen.startsWith('/wizard')) return '등록 작업';
  if (screen.startsWith('/orders')) return '주문 처리';
  if (screen.startsWith('/cs')) return 'CS 답변';
  if (screen.startsWith('/monitor')) return '모니터링';
  return screen;
}

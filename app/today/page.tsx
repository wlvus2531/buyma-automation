/**
 * /today — 메인 화면 (운영자가 매일 처음 보는 화면)
 *
 * 구성:
 *  - 좌 (8/12): 작업 카드 5개 (소싱 → 등록 → 발주 → CS → 모니터링)
 *  - 우 (4/12): 협업 사이드바 (접속자 + 승인 대기 + 활동 피드)
 *
 * 실시간 동작:
 *  - PresencePanel: 누가 어디 있는지 30초 갱신
 *  - ApprovalQueuePanel: 승인 큐 변동 즉시 반영
 *  - ActivityFeedPanel: 새 활동 발생 시 맨 위 추가
 */

'use client';

import { useEffect, useState } from 'react';
import { createBrowserSupabase, getCurrentUserId } from '@/lib/supabase';
import { PresencePanel } from '@/components/PresencePanel';
import { ApprovalQueuePanel } from '@/components/ApprovalQueuePanel';
import { ActivityFeedPanel } from '@/components/ActivityFeedPanel';
import { useApprovals } from '@/hooks/useApprovals';
import { useActivityFeed } from '@/hooks/useActivityFeed';
import type { User, UserRole } from '@/types';

export default function TodayPage() {
  const [me, setMe] = useState<User | null>(null);
  const [counts, setCounts] = useState({
    sourcing_pending: 0,
    register_pending: 0,
    orders_new: 0,
    cs_pending: 0,
    monitor_alerts: 0,
  });

  // 사용자 로드 (데모용 — 실제는 Supabase auth)
  useEffect(() => {
    (async () => {
      const supabase = createBrowserSupabase();
      let userId = getCurrentUserId();

      // 데모용: localStorage에 없으면 첫 운영자로 설정
      if (!userId) {
        const { data } = await supabase
          .from('users')
          .select('*')
          .eq('role', 'operator')
          .limit(1)
          .single();
        if (data) {
          localStorage.setItem('current_user_id', data.id);
          userId = data.id;
        }
      }

      if (userId) {
        const { data } = await supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .single();
        if (data) setMe(data as User);
      }
    })();
  }, []);

  // 작업 카드별 카운트 (간단화 — 실제는 각 도메인 테이블 집계)
  useEffect(() => {
    if (!me) return;
    (async () => {
      const supabase = createBrowserSupabase();
      const { count: sourcing } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'sourcing');
      const { count: register } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'ready_to_list');

      setCounts((c) => ({
        ...c,
        sourcing_pending: sourcing || 0,
        register_pending: register || 0,
      }));
    })();
  }, [me]);

  if (!me) {
    return (
      <div className="min-h-screen bg-stone-100 flex items-center justify-center">
        <div className="text-stone-500">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-100">
      <Header user={me} />

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-12 gap-6">
          {/* 좌측 메인 (8/12) */}
          <main className="col-span-12 lg:col-span-8">
            <PageHeader user={me} />
            <PausedWorkBanner currentUserId={me.id} />
            <TaskCardsList counts={counts} currentUserId={me.id} />
          </main>

          {/* 우측 협업 사이드바 (4/12) */}
          <aside className="col-span-12 lg:col-span-4 space-y-4">
            <PresencePanel
              currentUserId={me.id}
              currentScreen="/today"
            />
            <ApprovalQueuePanel
              currentUserId={me.id}
              currentUserRole={me.role}
            />
            <ActivityFeedPanel limit={15} />
          </aside>
        </div>
      </div>
    </div>
  );
}

// =====================================================
// 서브 컴포넌트들
// =====================================================

function Header({ user }: { user: User }) {
  return (
    <header className="bg-white border-b border-stone-200 sticky top-0 z-20">
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-stone-900 text-white flex items-center justify-center text-sm font-bold">B</div>
          <div>
            <div className="text-sm font-semibold text-stone-900">바이마 운영</div>
            <div className="text-[10px] text-stone-500">v3.1 실시간</div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-xs text-stone-500">접속:</span>
          <div className="w-7 h-7 rounded-full bg-stone-200 flex items-center justify-center">
            {user.avatar_emoji}
          </div>
          <span className="font-medium">{user.name}</span>
          {user.role === 'owner' && (
            <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-bold">
              OWNER
            </span>
          )}
        </div>
      </div>
    </header>
  );
}

function PageHeader({ user }: { user: User }) {
  return (
    <div className="mb-6 flex items-end justify-between flex-wrap gap-3">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-stone-500 mb-1">
          {new Date().toLocaleDateString('ko-KR', {
            month: 'long',
            day: 'numeric',
            weekday: 'long',
          })}{' '}
          · {user.name} 접속 중
        </p>
        <h1 className="text-3xl font-bold text-stone-900">오늘 할 일</h1>
      </div>
      <div className="text-sm text-stone-600">예상 4시간</div>
    </div>
  );
}

function PausedWorkBanner({ currentUserId }: { currentUserId: string }) {
  // 다른 사람이 만든 잠금 (등록 워크플로우 멈춰 있는 거) 찾기
  const [pausedLock, setPausedLock] = useState<any>(null);

  useEffect(() => {
    const supabase = createBrowserSupabase();
    (async () => {
      const { data } = await supabase
        .from('work_locks')
        .select('*, owner:users!work_locks_user_id_fkey(name)')
        .neq('user_id', currentUserId)
        .not('current_step', 'is', null)
        .order('acquired_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) setPausedLock(data);
    })();
  }, [currentUserId]);

  if (!pausedLock) return null;

  return (
    <section className="mb-4 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4">
      <div className="flex items-center gap-3">
        <span className="text-2xl">⏸️</span>
        <div className="flex-1">
          <div className="text-sm font-bold text-amber-900">
            {pausedLock.owner?.name}님이 등록 작업 Step {pausedLock.current_step}/5에서 멈춤
          </div>
          <div className="text-xs text-amber-800">
            자동 저장됨 · 이어서 작업 가능
          </div>
        </div>
        <button className="bg-amber-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-800">
          이어서 작업 →
        </button>
      </div>
    </section>
  );
}

function TaskCardsList({
  counts,
  currentUserId,
}: {
  counts: any;
  currentUserId: string;
}) {
  const { logActivity } = useActivityFeed(0);

  async function handleStart(taskType: string, route: string) {
    await logActivity({
      actor_label: '김운영', // 실제로는 me.name
      user_id: currentUserId,
      action_type: `${taskType}_start`,
      target_label: labelOfTask(taskType),
    });
    // 실제 라우팅: router.push(route)
    alert(`라우팅: ${route}`);
  }

  return (
    <>
      {/* ① 소싱 (가장 큼) */}
      <PrimaryTaskCard
        emoji="🧭"
        title="① 소싱 결정"
        timeShare="35%"
        priority="1순위"
        description="AI가 새벽에 추려둔 후보. OK/NG만 클릭 (1건당 20초)."
        progress={{ done: 3, total: 10 }}
        onStart={() => handleStart('sourcing', '/sourcing')}
      />

      {/* ② 등록 */}
      <SecondaryTaskCard
        emoji="📦"
        title="② 등록"
        timeShare="30%"
        description={`어제 OK한 ${counts.register_pending}개 등록 대기 중`}
        progress={{ done: 0, total: counts.register_pending }}
        onStart={() => handleStart('register', '/wizard')}
      />

      {/* ③ 발주 */}
      <SecondaryTaskCard
        emoji="🛒"
        title="③ 발주"
        timeShare="15%"
        description="바이마 신규 주문 → 한국몰 자동 발주"
        progress={{ done: 0, total: 3 }}
        onStart={() => handleStart('orders', '/orders')}
      />

      {/* ④ CS */}
      <SecondaryTaskCard
        emoji="💬"
        title="④ CS"
        timeShare="10%"
        description="AI 답변 초안 4건 · 검토 후 전송"
        progress={{ done: 0, total: 4 }}
        onStart={() => handleStart('cs', '/cs')}
      />

      {/* ⑤ 모니터링 (긴급 강조) */}
      <UrgentTaskCard
        emoji="🔔"
        title="⑤ 모니터링"
        timeShare="10%"
        description="🔴 긴급 1건 · 가격 5건 · 재고 2건"
        onStart={() => handleStart('monitor', '/monitor')}
      />
    </>
  );
}

function PrimaryTaskCard({
  emoji,
  title,
  timeShare,
  priority,
  description,
  progress,
  onStart,
}: any) {
  const pct = progress.total > 0 ? (progress.done / progress.total) * 100 : 0;
  return (
    <section className="mb-4 rounded-3xl border-2 border-stone-900 bg-white p-6 shadow-lg">
      <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{emoji}</span>
          <div>
            <div className="font-bold text-stone-900 text-xl">{title}</div>
            <p className="text-sm text-stone-600 mt-0.5">하루 시간의 {timeShare} · 가장 중요한 작업</p>
          </div>
        </div>
        <span className="text-xs bg-stone-900 text-white px-2 py-1 rounded-full">{priority}</span>
      </div>
      <p className="text-sm text-stone-700 mb-4">{description}</p>
      <div className="grid grid-cols-10 gap-1 mb-4">
        {Array.from({ length: progress.total }).map((_, i) => (
          <div
            key={i}
            className={`h-8 rounded ${
              i < progress.done
                ? 'bg-emerald-500 flex items-center justify-center text-white text-xs font-bold'
                : 'bg-stone-200'
            }`}
          >
            {i < progress.done && '✓'}
          </div>
        ))}
      </div>
      <div className="flex justify-between text-xs text-stone-500 mb-4">
        <span>{progress.done} 결정 완료</span>
        <span>{progress.total - progress.done} 대기 중</span>
      </div>
      <button
        onClick={onStart}
        className="w-full bg-stone-900 hover:bg-stone-700 text-white py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
      >
        소싱 결정 시작 →
      </button>
    </section>
  );
}

function SecondaryTaskCard({
  emoji,
  title,
  timeShare,
  description,
  progress,
  onStart,
}: any) {
  return (
    <section className="mb-3 rounded-2xl border border-stone-200 bg-white p-5 hover:border-stone-400 transition">
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{emoji}</span>
          <div>
            <div className="font-bold text-stone-900">
              {title}{' '}
              <span className="text-xs font-normal text-stone-500">· {timeShare}</span>
            </div>
            <p className="text-xs text-stone-600 mt-0.5">{description}</p>
          </div>
        </div>
        <button
          onClick={onStart}
          className="border border-stone-300 hover:bg-stone-50 px-4 py-2 rounded-lg text-sm"
        >
          시작 ▶
        </button>
      </div>
    </section>
  );
}

function UrgentTaskCard({ emoji, title, timeShare, description, onStart }: any) {
  return (
    <section className="mb-3 rounded-2xl border-2 border-red-300 bg-red-50/30 p-5">
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{emoji}</span>
          <div>
            <div className="font-bold text-stone-900">
              {title}{' '}
              <span className="text-xs font-normal text-stone-500">· {timeShare}</span>
            </div>
            <p className="text-xs text-stone-600 mt-0.5">{description}</p>
          </div>
        </div>
        <button
          onClick={onStart}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          우선 처리 ▶
        </button>
      </div>
    </section>
  );
}

function labelOfTask(t: string): string {
  return {
    sourcing: '소싱 결정',
    register: '등록 작업',
    orders: '발주',
    cs: 'CS 답변',
    monitor: '모니터링',
  }[t] || t;
}

/**
 * /today — 운영자 메인 (매일 처음 보는 화면)
 *
 * 좌 (8/12): 작업 카드 5개 (소싱 → 등록 → 발주 → CS → 모니터링)
 * 우 (4/12): 협업 사이드바 (접속자 + 승인 대기 + 활동 피드)
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabase, getCurrentUserId } from '@/lib/supabase';
import { PresencePanel } from '@/components/PresencePanel';
import { ApprovalQueuePanel } from '@/components/ApprovalQueuePanel';
import { ActivityFeedPanel } from '@/components/ActivityFeedPanel';
import { useActivityFeed } from '@/hooks/useActivityFeed';
import type { User } from '@/types';

interface DayCounts {
  sourcing_pending: number;   // 운영자 OK/NG 결정 대기 (AI가 추출했으나 listing 미생성)
  sourcing_done: number;       // 오늘 결정 완료
  register_pending: number;    // 사장님 승인 대기 (listing_status='ready')
  register_approved: number;   // 등록 예정 (listing_status='approved')
  orders_new: number;          // 신규 주문
  cs_pending: number;          // CS 답변 대기
  monitor_alerts: number;      // 모니터링 알림
}

export default function TodayPage() {
  const router = useRouter();
  const [me, setMe] = useState<User | null>(null);
  const [counts, setCounts] = useState<DayCounts>({
    sourcing_pending: 0,
    sourcing_done: 0,
    register_pending: 0,
    register_approved: 0,
    orders_new: 0,
    cs_pending: 0,
    monitor_alerts: 0,
  });

  const [loadError, setLoadError] = useState<string | null>(null);

  // 사용자 로드 (자가 복구: 운영자 없으면 자동 생성)
  useEffect(() => {
    (async () => {
      try {
        const supabase = createBrowserSupabase();
        let userId = await getCurrentUserId();

        // 1. localStorage에 있으면 그걸로 사용자 조회
        if (userId) {
          const { data } = await supabase.from('users').select('*').eq('id', userId).maybeSingle();
          if (data) {
            setMe(data as User);
            return;
          }
          // 저장된 user_id가 더 이상 유효하지 않으면 정리
          localStorage.removeItem('current_user_id');
          userId = null;
        }

        // 2. 첫 운영자 찾기
        const { data: existing } = await supabase
          .from('users')
          .select('*')
          .eq('role', 'operator')
          .limit(1)
          .maybeSingle();

        if (existing) {
          localStorage.setItem('current_user_id', existing.id);
          setMe(existing as User);
          return;
        }

        // 3. 운영자가 없으면 시드 생성 (anon insert 허용 가정)
        const { data: created, error: insertErr } = await supabase
          .from('users')
          .insert({
            name: '운영자',
            role: 'operator',
            avatar_emoji: '🧑‍💼',
            is_active: true,
          })
          .select()
          .maybeSingle();

        if (created) {
          localStorage.setItem('current_user_id', created.id);
          setMe(created as User);
        } else {
          setLoadError(insertErr?.message ?? '운영자 사용자 생성 실패 — Supabase users 테이블 확인 필요');
        }
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, []);

  // 작업 카드별 카운트 — listing_status 기준
  useEffect(() => {
    if (!me) return;
    (async () => {
      try {
      const supabase = createBrowserSupabase();

      // 소싱 결정 대기: name_jp/source_url 있는데 listing_status 미생성
      const sp = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .is('listing_status', null)
        .not('name_jp', 'is', null)
        .not('source_url', 'is', null);
      const sourcingPending = sp.count;

      // 오늘 등록 자료 생성 완료된 수 (오늘 만들어진 ready/approved/listed)
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const sd = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .in('listing_status', ['ready', 'approved', 'listed'])
        .gte('created_at', todayStart.toISOString());
      const sourcingDone = sd.count;

      // 사장님 승인 대기
      const rp = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('listing_status', 'ready');
      const registerPending = rp.count;

      // 등록 예정 (사장님 승인 완료, 바이마 미등록)
      const ra = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('listing_status', 'approved');
      const registerApproved = ra.count;

      // CS 미답변 카운트
      let csPending = 0;
      try {
        const csRes = await fetch('/api/cs');
        if (csRes.ok) {
          const csData = await csRes.json();
          csPending = csData.pending || 0;
        }
      } catch {}

      // 모니터링 알림 카운트 (오늘)
      let monitorAlerts = 0;
      try {
        const monRes = await fetch('/api/monitor/list?summary=true');
        if (monRes.ok) {
          const monData = await monRes.json();
          monitorAlerts = monData.alerts || 0;
        }
      } catch {}

      setCounts({
        sourcing_pending: sourcingPending || 0,
        sourcing_done: sourcingDone || 0,
        register_pending: registerPending || 0,
        register_approved: registerApproved || 0,
        orders_new: 0,
        cs_pending: csPending,
        monitor_alerts: monitorAlerts,
      });
      } catch (e) {
        console.warn('[today] counts load failed (continuing with zeros):', e);
      }
    })();
  }, [me]);

  if (!me) {
    if (loadError) {
      return (
        <div className="rounded-2xl border-2 border-red-200 bg-red-50 p-6 max-w-2xl">
          <div className="font-bold text-red-900 mb-2">초기화 실패</div>
          <div className="text-sm text-red-800 mb-3">{loadError}</div>
          <div className="text-xs text-red-700">
            Supabase SQL 에디터에서 아래를 실행해주세요:
            <pre className="mt-2 bg-white p-2 rounded text-stone-800 overflow-x-auto">{`INSERT INTO users (name, role, avatar_emoji, is_active)
VALUES ('운영자', 'operator', '🧑‍💼', true);`}</pre>
          </div>
        </div>
      );
    }
    return <div className="text-stone-500">로딩 중...</div>;
  }

  return (
    <div>
      <RoadmapCompleteBanner />
      <div className="grid grid-cols-12 gap-6">
        {/* 좌측 메인 (8/12) */}
        <main className="col-span-12 lg:col-span-8">
          <PageHeader user={me} />
          <PausedWorkBanner currentUserId={me.id} />
          <TaskCardsList counts={counts} currentUserId={me.id} userName={me.name} router={router} />
        </main>

        {/* 우측 협업 사이드바 (4/12) */}
        <aside className="col-span-12 lg:col-span-4 space-y-4">
          <PresencePanel currentUserId={me.id} currentScreen="/today" />
          <ApprovalQueuePanel currentUserId={me.id} currentUserRole={me.role} />
          <ActivityFeedPanel limit={15} />
        </aside>
      </div>
    </div>
  );
}

// =====================================================
// 서브 컴포넌트
// =====================================================

function RoadmapCompleteBanner() {
  return (
    <div className="mb-6 rounded-2xl bg-gradient-to-r from-stone-900 to-stone-700 text-white p-5 flex items-center gap-4">
      <div className="text-3xl">🎉</div>
      <div className="flex-1">
        <div className="font-bold text-lg mb-0.5">8주 로드맵 완료!</div>
        <div className="text-stone-300 text-sm">소싱 → 스크래퍼 → 번역 → 대시보드 → 등록 → 사장님 PWA → Chrome 확장 V1/V2 → CS 자동화 · 전체 파이프라인 가동 중 ✓</div>
      </div>
      <div className="hidden sm:grid grid-cols-4 gap-1 text-[10px] text-center shrink-0">
        {['W1 기초', 'W2 소싱', 'W3 스크래퍼', 'W4 번역', 'W5 등록', 'W6 모니터링', 'W7 자동입력', 'W8 CS'].map((w, i) => (
          <div key={i} className="bg-white/10 rounded px-1.5 py-1 text-white font-medium">{w} ✓</div>
        ))}
      </div>
    </div>
  );
}

function PageHeader({ user }: { user: User }) {
  return (
    <div className="mb-6 flex items-end justify-between flex-wrap gap-3">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-stone-500 mb-1">
          {new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })}
          {' · '}{user.name} 접속 중
        </p>
        <h1 className="text-3xl font-bold text-stone-900">오늘 할 일</h1>
      </div>
      <div className="text-sm text-stone-600">예상 4시간</div>
    </div>
  );
}

function PausedWorkBanner({ currentUserId }: { currentUserId: string }) {
  const [pausedLock, setPausedLock] = useState<{
    resource_type: string;
    resource_id: string;
    current_step: number | null;
    owner_name: string | null;
  } | null>(null);

  useEffect(() => {
    const supabase = createBrowserSupabase();
    (async () => {
      const { data } = await supabase
        .from('work_locks')
        .select('resource_type, resource_id, current_step, owner:users!work_locks_user_id_fkey(name)')
        .neq('user_id', currentUserId)
        .not('current_step', 'is', null)
        .order('acquired_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        const ownerRaw = (data as { owner?: { name: string } | { name: string }[] | null }).owner;
        const owner = Array.isArray(ownerRaw) ? ownerRaw[0] : ownerRaw;
        setPausedLock({
          resource_type: data.resource_type,
          resource_id: data.resource_id,
          current_step: data.current_step,
          owner_name: owner?.name ?? null,
        });
      }
    })();
  }, [currentUserId]);

  if (!pausedLock) return null;

  return (
    <section className="mb-4 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4">
      <div className="flex items-center gap-3">
        <span className="text-2xl">⏸️</span>
        <div className="flex-1">
          <div className="text-sm font-bold text-amber-900">
            {pausedLock.owner_name ?? '다른 사용자'}님이 등록 작업 Step {pausedLock.current_step}/5에서 멈춤
          </div>
          <div className="text-xs text-amber-800">자동 저장됨 · 이어서 작업 가능</div>
        </div>
        <a
          href="/register"
          className="bg-amber-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-800"
        >
          이어서 작업 →
        </a>
      </div>
    </section>
  );
}

function TaskCardsList({
  counts,
  currentUserId,
  userName,
  router,
}: {
  counts: DayCounts;
  currentUserId: string;
  userName: string;
  router: ReturnType<typeof useRouter>;
}) {
  const { logActivity } = useActivityFeed(0);

  async function go(taskType: string, route: string, label: string) {
    await logActivity({
      actor_label: userName,
      user_id: currentUserId,
      action_type: `${taskType}_start`,
      target_label: label,
    });
    router.push(route);
  }

  // 소싱 결정 진행률
  const sourcingTotal = counts.sourcing_pending + counts.sourcing_done;
  const sourcingPct = sourcingTotal > 0 ? Math.round((counts.sourcing_done / sourcingTotal) * 100) : 0;

  return (
    <>
      {/* ① 소싱 (가장 큼) */}
      <PrimaryTaskCard
        emoji="🧭"
        title="① 소싱 결정"
        timeShare="35%"
        priority="1순위"
        description={
          counts.sourcing_pending > 0
            ? `AI가 추출한 후보 ${counts.sourcing_pending}건 검토 대기 (1건당 20초)`
            : '검토 대기 중인 소싱 후보가 없습니다 — 새벽 4시에 자동 추출됩니다'
        }
        progress={{ done: counts.sourcing_done, total: Math.max(sourcingTotal, 10) }}
        progressLabel={`${counts.sourcing_done}건 처리 완료 · ${counts.sourcing_pending}건 대기`}
        actionLabel={counts.sourcing_pending > 0 ? '소싱 결정 시작 →' : '소싱 후보 보기 →'}
        onStart={() => go('sourcing', '/products', 'AI 소싱 상품')}
      />

      {/* ② 등록 */}
      <SecondaryTaskCard
        emoji="📦"
        title="② 등록"
        timeShare="30%"
        description={
          counts.register_pending > 0
            ? `사장님 승인 대기 ${counts.register_pending}건 · 등록 예정 ${counts.register_approved}건`
            : counts.register_approved > 0
            ? `바이마 등록 대기 ${counts.register_approved}건`
            : '등록 대기 항목 없음'
        }
        badge={counts.register_pending + counts.register_approved}
        onStart={() => go('register', '/register', '등록 워크플로우')}
        disabled={counts.register_pending + counts.register_approved === 0}
      />

      {/* ③ 발주 */}
      <SecondaryTaskCard
        emoji="🛒"
        title="③ 발주"
        timeShare="15%"
        description="바이마 신규 주문 → 한국몰 자동 발주"
        badge={counts.orders_new}
        onStart={() => go('orders', '/orders', '주문/발주')}
      />

      {/* ④ CS */}
      <SecondaryTaskCard
        emoji="💬"
        title="④ CS"
        timeShare="10%"
        description={
          counts.cs_pending > 0
            ? `미답변 ${counts.cs_pending}건 — AI 답변 초안 검토 대기`
            : 'BUYMA 고객 문의 AI 자동 답변'
        }
        badge={counts.cs_pending}
        onStart={() => go('cs', '/cs', 'CS 자동화')}
      />

      {/* ⑤ 모니터링 */}
      <UrgentTaskCard
        emoji="🔔"
        title="⑤ 모니터링"
        timeShare="10%"
        description={
          counts.monitor_alerts > 0
            ? `경쟁자 가격 변동 ${counts.monitor_alerts}건 알림`
            : 'Chrome 확장으로 경쟁자 가격·순위 실시간 수집'
        }
        urgent={counts.monitor_alerts > 0}
        onStart={() => go('monitor', '/monitor', '모니터링')}
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
  progressLabel,
  actionLabel,
  onStart,
}: {
  emoji: string;
  title: string;
  timeShare: string;
  priority: string;
  description: string;
  progress: { done: number; total: number };
  progressLabel: string;
  actionLabel: string;
  onStart: () => void;
}) {
  const cells = Math.min(progress.total, 10);
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

      <div className="grid grid-cols-10 gap-1 mb-2">
        {Array.from({ length: cells }).map((_, i) => (
          <div
            key={i}
            className={
              i < progress.done
                ? 'h-8 rounded bg-emerald-500 flex items-center justify-center text-white text-xs font-bold'
                : 'h-8 rounded bg-stone-200'
            }
          >
            {i < progress.done && '✓'}
          </div>
        ))}
      </div>
      <div className="text-xs text-stone-500 mb-4">{progressLabel}</div>

      <button
        onClick={onStart}
        className="w-full bg-stone-900 hover:bg-stone-700 text-white py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
      >
        {actionLabel}
      </button>
    </section>
  );
}

function SecondaryTaskCard({
  emoji,
  title,
  timeShare,
  description,
  badge,
  onStart,
  disabled = false,
}: {
  emoji: string;
  title: string;
  timeShare: string;
  description: string;
  badge?: number;
  onStart: () => void;
  disabled?: boolean;
}) {
  return (
    <section className={`mb-3 rounded-2xl border bg-white p-5 transition ${disabled ? 'border-stone-200 opacity-60' : 'border-stone-200 hover:border-stone-400'}`}>
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{emoji}</span>
          <div>
            <div className="font-bold text-stone-900 flex items-center gap-2">
              {title}
              <span className="text-xs font-normal text-stone-500">· {timeShare}</span>
              {badge != null && badge > 0 && (
                <span className="text-[10px] font-bold bg-stone-900 text-white px-1.5 py-0.5 rounded-full">
                  {badge}
                </span>
              )}
            </div>
            <p className="text-xs text-stone-600 mt-0.5">{description}</p>
          </div>
        </div>
        <button
          onClick={onStart}
          disabled={disabled}
          className="border border-stone-300 hover:bg-stone-50 px-4 py-2 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {disabled ? '준비 중' : '시작 ▶'}
        </button>
      </div>
    </section>
  );
}

function UrgentTaskCard({
  emoji,
  title,
  timeShare,
  description,
  urgent,
  onStart,
  disabled = false,
}: {
  emoji: string;
  title: string;
  timeShare: string;
  description: string;
  urgent: boolean;
  onStart: () => void;
  disabled?: boolean;
}) {
  return (
    <section className={`mb-3 rounded-2xl border-2 p-5 ${urgent ? 'border-red-300 bg-red-50/30' : 'border-stone-200 bg-white opacity-60'}`}>
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{emoji}</span>
          <div>
            <div className="font-bold text-stone-900">
              {title} <span className="text-xs font-normal text-stone-500">· {timeShare}</span>
            </div>
            <p className="text-xs text-stone-600 mt-0.5">{description}</p>
          </div>
        </div>
        <button
          onClick={onStart}
          disabled={disabled}
          className={
            urgent
              ? 'bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium'
              : 'border border-stone-300 px-4 py-2 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed'
          }
        >
          {disabled ? '준비 중' : urgent ? '우선 처리 ▶' : '시작 ▶'}
        </button>
      </div>
    </section>
  );
}

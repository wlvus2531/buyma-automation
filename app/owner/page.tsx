/**
 * /owner — 사장님 모바일 PWA 메인
 *
 * 3개 탭:
 *  ① 승인 대기 (큰 카드 + ✅/❌ 버튼)
 *  ② 운영 현황 (오늘 매출 + 진행률)
 *  ③ 활동 피드 (실시간)
 *
 * 첫 접속 시: 푸시 구독 + 사용자 식별
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { createBrowserSupabase, getCurrentUserId } from '@/lib/supabase';
import { useApprovals } from '@/hooks/useApprovals';
import { useActivityFeed } from '@/hooks/useActivityFeed';
import { useRealtimePresence } from '@/hooks/useRealtimePresence';
import type { User, ApprovalWithUser } from '@/types';
import {
  Bell, Check, X, Edit3, ChevronLeft, BarChart3,
  ListChecks, History, Smartphone, Loader2, AlertTriangle,
} from 'lucide-react';

type Tab = 'approvals' | 'status' | 'feed';

export default function OwnerPage() {
  const [me, setMe] = useState<User | null>(null);
  const [tab, setTab] = useState<Tab>('approvals');
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default');
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [activeApproval, setActiveApproval] = useState<ApprovalWithUser | null>(null);

  // 사장님 사용자 로드 (자가 복구: 없으면 자동 생성)
  useEffect(() => {
    (async () => {
      const supabase = createBrowserSupabase();
      const userId = await getCurrentUserId();

      // /owner는 사장님 전용 — owner role 자동 매칭
      const { data: owner } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'owner')
        .limit(1)
        .maybeSingle();

      if (owner) {
        if (!userId || userId !== owner.id) {
          localStorage.setItem('current_user_id', owner.id);
        }
        setMe(owner as User);
        return;
      }

      // 사장님 계정이 없으면 자동 생성
      const { data: created } = await supabase
        .from('users')
        .insert({
          name: '사장님',
          role: 'owner',
          avatar_emoji: '👔',
          is_active: true,
        })
        .select()
        .maybeSingle();

      if (created) {
        localStorage.setItem('current_user_id', created.id);
        setMe(created as User);
      }
    })();
  }, []);

  // Service Worker 등록 + 알림 권한 체크
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch((e) => console.error('SW 등록 실패', e));
    if ('Notification' in window) setPushPermission(Notification.permission);
    (async () => {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setPushSubscribed(!!sub);
    })();
  }, []);

  // 접속 추적
  useRealtimePresence({
    userId: me?.id ?? null,
    currentScreen: '/owner',
    currentResourceId: activeApproval?.id ?? null,
    device: 'mobile',
  });

  if (!me) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <Loader2 className="animate-spin text-stone-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 pb-20">
      <OwnerHeader user={me} />

      {pushPermission !== 'granted' && !pushSubscribed && (
        <PushBanner userId={me.id} onSubscribed={() => setPushSubscribed(true)} />
      )}

      {activeApproval ? (
        <ApprovalDetail
          approval={activeApproval}
          userId={me.id}
          onClose={() => setActiveApproval(null)}
        />
      ) : (
        <>
          {tab === 'approvals' && <ApprovalsTab onSelect={setActiveApproval} />}
          {tab === 'status'    && <StatusTab />}
          {tab === 'feed'      && <FeedTab />}
        </>
      )}

      {!activeApproval && <BottomTabs tab={tab} onChange={setTab} />}
    </div>
  );
}

// =====================================================
// Header — 상단바
// =====================================================
function OwnerHeader({ user }: { user: User }) {
  const time = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  return (
    <header className="bg-white border-b border-stone-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-20">
      <div className="w-9 h-9 rounded-lg bg-stone-900 text-white flex items-center justify-center text-sm font-bold">B</div>
      <div className="flex-1">
        <div className="text-sm font-semibold text-stone-900 leading-tight">바이마 사장님</div>
        <div className="text-[10px] text-stone-500">실시간 운영 · {time}</div>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-lg">{user.avatar_emoji}</span>
        <span className="text-xs font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">OWNER</span>
      </div>
    </header>
  );
}

// =====================================================
// 푸시 권한 배너
// =====================================================
function PushBanner({ userId, onSubscribed }: { userId: string; onSubscribed: () => void }) {
  const [busy, setBusy] = useState(false);

  async function enable() {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        alert('알림 권한이 거부되었습니다. 브라우저 설정에서 허용해주세요.');
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        alert('VAPID 공개키가 설정되지 않았습니다.\n환경변수 NEXT_PUBLIC_VAPID_PUBLIC_KEY를 설정해주세요.');
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey).buffer as ArrayBuffer,
      });
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub.toJSON(), userId }),
      });
      const data = await res.json();
      if (data.ok) {
        onSubscribed();
      } else {
        alert(`구독 실패: ${data.error}`);
      }
    } catch (e) {
      alert(`오류: ${e instanceof Error ? e.message : e}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="m-3 rounded-2xl bg-stone-900 text-white p-4">
      <div className="flex items-center gap-3 mb-3">
        <Bell size={20} className="text-amber-400" />
        <div className="flex-1">
          <div className="text-sm font-semibold">푸시 알림 켜기</div>
          <div className="text-[11px] text-stone-300">승인 요청을 즉시 받으려면 필요합니다</div>
        </div>
      </div>
      <button
        onClick={enable}
        disabled={busy}
        className="w-full py-2.5 rounded-xl bg-amber-500 text-stone-900 text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Bell size={14} />}
        알림 받기
      </button>
    </div>
  );
}

// =====================================================
// 탭: 승인 대기
// =====================================================
function ApprovalsTab({ onSelect }: { onSelect: (a: ApprovalWithUser) => void }) {
  const { pending } = useApprovals();

  if (pending.length === 0) {
    return (
      <div className="p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
          <Check size={26} className="text-emerald-600" />
        </div>
        <p className="font-semibold text-stone-700">승인 대기 없음</p>
        <p className="text-xs text-stone-500 mt-1">새 요청이 오면 푸시로 알려드립니다</p>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-2">
      {pending.map((a) => (
        <button
          key={a.id}
          onClick={() => onSelect(a)}
          className="w-full text-left bg-white rounded-2xl border border-stone-200 p-4 active:bg-stone-50 transition-colors"
        >
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="text-sm font-bold text-stone-900">{a.target_label}</div>
            <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold whitespace-nowrap">
              {minutesAgo(a.created_at)}
            </span>
          </div>
          <div className="text-xs text-stone-500 mb-2">{a.rule_violated || labelOfType(a.request_type)}</div>
          <ProposedSummary value={a.proposed_value as Record<string, unknown> | null} />
          {a.note && <div className="mt-2 text-[11px] text-stone-600 italic">"{a.note}"</div>}
        </button>
      ))}
    </div>
  );
}

function ProposedSummary({ value }: { value: Record<string, unknown> | null }) {
  if (!value) return null;
  const items: string[] = [];
  if (value.price_jpy) items.push(`¥${(value.price_jpy as number).toLocaleString()}`);
  if (value.margin_pct) items.push(`마진 ${value.margin_pct}%`);
  if (items.length === 0) return null;
  return <div className="text-xs text-stone-700 font-medium">{items.join(' · ')}</div>;
}

// =====================================================
// 승인 상세 — 1초 결정 화면
// =====================================================
function ApprovalDetail({
  approval,
  userId,
  onClose,
}: {
  approval: ApprovalWithUser;
  userId: string;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [editValue, setEditValue] = useState(
    (approval.proposed_value as { price_jpy?: number } | null)?.price_jpy ?? 0
  );

  async function decide(action: 'approve' | 'reject', decided_value?: Record<string, unknown>) {
    setBusy(action);
    try {
      const res = await fetch('/api/approvals/decide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approval_id: approval.id,
          action,
          userId,
          decided_value,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        // 햅틱 (지원되는 기기)
        if ('vibrate' in navigator) navigator.vibrate(action === 'approve' ? [40] : [80, 40, 80]);
        onClose();
      } else {
        alert(data.error || '처리 실패');
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : '오류');
    } finally {
      setBusy(null);
    }
  }

  const proposed = approval.proposed_value as Record<string, unknown> | null;

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="bg-white border-b border-stone-200 px-4 py-3 flex items-center gap-2 sticky top-0 z-10">
        <button onClick={onClose} className="text-stone-500 active:text-stone-900">
          <ChevronLeft size={22} />
        </button>
        <span className="text-sm font-semibold">승인 결정</span>
      </div>

      <div className="p-4 space-y-4">
        {/* 큰 카드 */}
        <div className="bg-white rounded-3xl border border-stone-200 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-14 h-14 rounded-xl bg-stone-100 flex items-center justify-center text-2xl">📦</div>
            <div className="flex-1">
              <div className="text-[10px] uppercase text-stone-500 tracking-wider">
                {labelOfType(approval.request_type)}
              </div>
              <div className="text-base font-bold text-stone-900 leading-tight">{approval.target_label}</div>
            </div>
          </div>

          {approval.rule_violated && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3">
              <div className="text-[10px] uppercase font-bold text-amber-800 mb-0.5 flex items-center gap-1">
                <AlertTriangle size={11} /> 룰 위반
              </div>
              <div className="text-sm text-amber-900 font-medium">{approval.rule_violated}</div>
            </div>
          )}

          {proposed && (
            <div className="space-y-1.5 text-sm border-t border-stone-100 pt-3">
              {Object.entries(proposed).map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-stone-500">{labelOfKey(k)}</span>
                  <span className="font-semibold text-stone-900">{formatVal(k, v)}</span>
                </div>
              ))}
            </div>
          )}

          {approval.note && (
            <div className="mt-3 pt-3 border-t border-stone-100 text-[12px] text-stone-600">
              <b className="text-stone-700">{approval.requester?.name ?? '운영자'} 메모:</b>
              <p className="mt-1 italic">"{approval.note}"</p>
            </div>
          )}
        </div>

        {/* 액션 버튼 */}
        {!showEdit ? (
          <div className="space-y-2">
            <button
              onClick={() => decide('approve')}
              disabled={!!busy}
              className="w-full bg-emerald-600 active:bg-emerald-700 text-white py-4 rounded-2xl text-base font-bold flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm"
            >
              {busy === 'approve' ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
              승인하기
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => decide('reject')}
                disabled={!!busy}
                className="border border-stone-300 active:bg-stone-100 py-3 rounded-2xl text-sm font-medium flex items-center justify-center gap-1 disabled:opacity-50"
              >
                {busy === 'reject' ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                거부
              </button>
              <button
                onClick={() => setShowEdit(true)}
                disabled={!!busy}
                className="border border-stone-300 active:bg-stone-100 py-3 rounded-2xl text-sm font-medium flex items-center justify-center gap-1"
              >
                <Edit3 size={14} />
                수정값
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-stone-200 p-4 space-y-3">
            <div>
              <label className="text-xs font-medium text-stone-600 mb-1 block">수정 가격 (JPY)</label>
              <input
                type="number"
                value={editValue}
                onChange={(e) => setEditValue(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-stone-300 text-sm font-semibold"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setShowEdit(false)}
                className="border border-stone-300 py-2.5 rounded-xl text-sm"
              >
                취소
              </button>
              <button
                onClick={() => decide('approve', { price_jpy: editValue })}
                disabled={!!busy}
                className="bg-emerald-600 text-white py-2.5 rounded-xl text-sm font-bold disabled:opacity-50"
              >
                {busy ? <Loader2 size={14} className="animate-spin inline" /> : '수정값으로 승인'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// =====================================================
// 탭: 운영 현황
// =====================================================
function StatusTab() {
  const [stats, setStats] = useState({
    sourcing_today: 0,
    listing_pending: 0,
    listing_approved: 0,
    listed_today: 0,
  });

  const load = useCallback(async () => {
    const supabase = createBrowserSupabase();
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const [sourcing, pending, approved, listed] = await Promise.all([
      supabase.from('products').select('*', { count: 'exact', head: true }).gte('created_at', start.toISOString()),
      supabase.from('products').select('*', { count: 'exact', head: true }).eq('listing_status', 'ready'),
      supabase.from('products').select('*', { count: 'exact', head: true }).eq('listing_status', 'approved'),
      supabase.from('products').select('*', { count: 'exact', head: true }).eq('listing_status', 'listed').gte('listed_at', start.toISOString()),
    ]);

    setStats({
      sourcing_today: sourcing.count ?? 0,
      listing_pending: pending.count ?? 0,
      listing_approved: approved.count ?? 0,
      listed_today: listed.count ?? 0,
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="p-3 space-y-3">
      {/* KPI 큰 카드 */}
      <div className="bg-stone-900 text-white rounded-2xl p-5">
        <div className="text-[10px] uppercase tracking-wider text-stone-400 mb-1">오늘 소싱</div>
        <div className="text-4xl font-bold tabular-nums">{stats.sourcing_today}</div>
        <div className="text-xs text-stone-300 mt-1">새벽 AI 추출 + 추가 발굴</div>
      </div>

      {/* 진행률 */}
      <div className="bg-white rounded-2xl border border-stone-200 p-5">
        <div className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3">파이프라인 현황</div>
        <div className="space-y-3">
          <Progress label="승인 대기" count={stats.listing_pending} color="bg-amber-500" />
          <Progress label="등록 예정" count={stats.listing_approved} color="bg-indigo-500" />
          <Progress label="오늘 등록" count={stats.listed_today} color="bg-emerald-500" />
        </div>
      </div>
    </div>
  );
}

function Progress({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-stone-700 w-20 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-stone-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${Math.min(count * 10, 100)}%` }} />
      </div>
      <span className="text-sm font-bold tabular-nums text-stone-900 w-8 text-right">{count}</span>
    </div>
  );
}

// =====================================================
// 탭: 활동 피드
// =====================================================
function FeedTab() {
  const { items } = useActivityFeed(30);
  return (
    <div className="p-3 space-y-2">
      {items.length === 0 && (
        <div className="text-center text-sm text-stone-500 py-8">활동 없음</div>
      )}
      {items.map((it) => (
        <div key={it.id} className="bg-white rounded-xl border border-stone-200 p-3">
          <div className="flex items-start gap-2">
            <span className="text-[10px] text-stone-400 tabular-nums shrink-0 w-12">
              {minutesAgo(it.created_at)}
            </span>
            <div className="flex-1 text-xs">
              <span className="font-bold text-stone-900">{it.actor_label}</span>
              <span className="text-stone-600 ml-1">{labelOfAction(it.action_type)}</span>
              {it.target_label && (
                <div className="text-[11px] text-stone-500 mt-0.5">{it.target_label}</div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// =====================================================
// 하단 탭바
// =====================================================
function BottomTabs({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  const items: { key: Tab; label: string; icon: typeof Bell }[] = [
    { key: 'approvals', label: '승인',     icon: ListChecks },
    { key: 'status',    label: '현황',     icon: BarChart3 },
    { key: 'feed',      label: '피드',     icon: History },
  ];
  return (
    <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-stone-200 grid grid-cols-3 z-30">
      {items.map(({ key, label, icon: Icon }) => {
        const active = tab === key;
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={`py-2.5 flex flex-col items-center gap-0.5 ${
              active ? 'text-stone-900' : 'text-stone-400'
            }`}
          >
            <Icon size={20} strokeWidth={active ? 2.5 : 2} />
            <span className={`text-[10px] ${active ? 'font-bold' : 'font-medium'}`}>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}

// =====================================================
// 유틸
// =====================================================
function minutesAgo(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return '지금';
  if (m < 60) return `${m}분`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간`;
  return `${Math.floor(h / 24)}일`;
}

function labelOfType(t: string): string {
  return {
    price_below_margin: '마진 부족',
    price_high_unit: '고가 상품',
    new_category: '신규 카테고리',
    refund: '환불 요청',
    large_price_drop: '큰 가격 변동',
    owner_to_operator: '사장님 지시',
  }[t] || t;
}

function labelOfAction(t: string): string {
  if (t.includes('approve')) return '승인';
  if (t.includes('reject')) return '거부';
  if (t.includes('start')) return '시작';
  if (t.includes('listing')) return '등록 처리';
  if (t.includes('sourcing')) return '소싱';
  return t.replace(/_/g, ' ');
}

function labelOfKey(k: string): string {
  return {
    price_jpy: '가격 (JPY)',
    margin_pct: '마진율',
    cost_krw: '매입가 (KRW)',
  }[k] || k;
}

function formatVal(k: string, v: unknown): string {
  if (typeof v === 'number') {
    if (k === 'price_jpy') return `¥${v.toLocaleString()}`;
    if (k === 'cost_krw') return `₩${v.toLocaleString()}`;
    if (k === 'margin_pct') return `${v}%`;
    return v.toLocaleString();
  }
  return String(v);
}

// VAPID 공개키 변환 (Web Push 표준)
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

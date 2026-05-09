/**
 * /cs — CS 자동화 대시보드
 * 고객 문의 붙여넣기 → Claude Haiku 일본어 답변 초안 생성 → 검토 후 전송
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface CSThread {
  id: string;
  order_id: string | null;
  customer_name: string | null;
  customer_message: string;
  ai_reply: string | null;
  final_reply: string | null;
  status: 'pending' | 'generating' | 'replied' | 'escalated';
  category: '배송' | '환불' | '상품문의' | '기타';
  notes: string | null;
  created_at: string;
  replied_at: string | null;
}

const CATEGORY_COLOR: Record<string, string> = {
  '배송':    'bg-blue-100 text-blue-700',
  '환불':    'bg-red-100 text-red-700',
  '상품문의': 'bg-purple-100 text-purple-700',
  '기타':    'bg-stone-100 text-stone-600',
};

const STATUS_LABEL: Record<string, string> = {
  pending:    '답변 대기',
  generating: 'AI 생성 중...',
  replied:    '답변 완료',
  escalated:  '에스컬레이션',
};

export default function CSPage() {
  const [threads, setThreads]       = useState<CSThread[]>([]);
  const [selected, setSelected]     = useState<CSThread | null>(null);
  const [pending, setPending]       = useState(0);
  const [loading, setLoading]       = useState(true);
  const [filter, setFilter]         = useState<'all' | 'pending' | 'replied'>('all');
  const [showNew, setShowNew]       = useState(false);
  const [toast, setToast]           = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const params = filter !== 'all' ? `?status=${filter}` : '';
    const res = await fetch(`/api/cs${params}`);
    const data = await res.json();
    setThreads(data.threads || []);
    setPending(data.pending || 0);
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  function selectThread(t: CSThread) {
    // 최신 데이터 동기화
    setSelected(t);
    setThreads(prev => prev.map(x => x.id === t.id ? t : x));
  }

  async function handleAction(id: string, action: 'replied' | 'escalated', finalReply?: string) {
    const res = await fetch('/api/cs/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action, final_reply: finalReply }),
    });
    const data = await res.json();
    if (data.ok) {
      showToast(action === 'replied' ? '✓ 답변 완료 처리됨' : '⚠️ 에스컬레이션 처리됨');
      await load();
      setSelected(null);
    }
  }

  return (
    <div>
      {/* 헤더 */}
      <div className="mb-6 flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-stone-500 mb-1">Week 8 · AI 자동화</p>
          <h1 className="text-3xl font-bold text-stone-900">CS 자동화</h1>
        </div>
        <div className="flex items-center gap-3">
          {pending > 0 && (
            <span className="bg-red-600 text-white text-xs font-bold px-2.5 py-1 rounded-full">
              미답변 {pending}건
            </span>
          )}
          <button
            onClick={() => setShowNew(true)}
            className="bg-stone-900 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-stone-700"
          >
            + 새 문의 등록
          </button>
        </div>
      </div>

      {/* 탭 필터 */}
      <div className="flex gap-1 mb-4 bg-stone-100 rounded-xl p-1 w-fit">
        {(['all', 'pending', 'replied'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === f ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            {f === 'all' ? '전체' : f === 'pending' ? '미답변' : '완료'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* 스레드 목록 (좌측 5/12) */}
        <div className="col-span-12 lg:col-span-5">
          {loading ? (
            <div className="space-y-2">{[1,2,3].map(i => (
              <div key={i} className="bg-white rounded-xl border border-stone-200 h-20 animate-pulse" />
            ))}</div>
          ) : threads.length === 0 ? (
            <EmptyCS onNew={() => setShowNew(true)} />
          ) : (
            <div className="space-y-2">
              {threads.map(t => (
                <ThreadCard
                  key={t.id}
                  thread={t}
                  active={selected?.id === t.id}
                  onClick={() => selectThread(t)}
                />
              ))}
            </div>
          )}
        </div>

        {/* 상세 / 답변 패널 (우측 7/12) */}
        <div className="col-span-12 lg:col-span-7">
          {selected ? (
            <ThreadDetail
              thread={selected}
              onUpdate={selectThread}
              onAction={handleAction}
              onToast={showToast}
            />
          ) : (
            <div className="bg-white rounded-2xl border border-stone-200 h-80 flex items-center justify-center text-stone-400 text-sm">
              좌측에서 문의를 선택하세요
            </div>
          )}
        </div>
      </div>

      {/* 새 문의 모달 */}
      {showNew && (
        <NewThreadModal
          onClose={() => setShowNew(false)}
          onCreated={async () => { setShowNew(false); await load(); }}
          onToast={showToast}
        />
      )}

      {/* 토스트 */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-stone-900 text-white text-sm px-4 py-2.5 rounded-xl shadow-xl z-50">
          {toast}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// 스레드 카드
// ──────────────────────────────────────────────
function ThreadCard({ thread, active, onClick }: { thread: CSThread; active: boolean; onClick: () => void }) {
  const timeAgo = (() => {
    const diff = (Date.now() - new Date(thread.created_at).getTime()) / 60000;
    if (diff < 60) return `${Math.floor(diff)}분 전`;
    if (diff < 1440) return `${Math.floor(diff / 60)}시간 전`;
    return `${Math.floor(diff / 1440)}일 전`;
  })();

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl border p-4 cursor-pointer transition-all ${
        active ? 'border-stone-900 shadow-sm' : 'border-stone-200 hover:border-stone-400'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${CATEGORY_COLOR[thread.category] || CATEGORY_COLOR['기타']}`}>
          {thread.category}
        </span>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
            thread.status === 'replied' ? 'bg-emerald-100 text-emerald-700' :
            thread.status === 'generating' ? 'bg-amber-100 text-amber-700' :
            thread.status === 'escalated' ? 'bg-red-100 text-red-700' :
            'bg-stone-100 text-stone-600'
          }`}>
            {STATUS_LABEL[thread.status]}
          </span>
          <span className="text-xs text-stone-400">{timeAgo}</span>
        </div>
      </div>
      <p className="text-sm text-stone-700 line-clamp-2">{thread.customer_message}</p>
      {thread.notes && (
        <p className="text-xs text-stone-400 mt-1 truncate">요약: {thread.notes}</p>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// 스레드 상세 + AI 답변 패널
// ──────────────────────────────────────────────
function ThreadDetail({
  thread,
  onUpdate,
  onAction,
  onToast,
}: {
  thread: CSThread;
  onUpdate: (t: CSThread) => void;
  onAction: (id: string, action: 'replied' | 'escalated', finalReply?: string) => void;
  onToast: (msg: string) => void;
}) {
  const [generating, setGenerating] = useState(false);
  const [editReply, setEditReply]   = useState(thread.ai_reply || '');
  const textRef = useRef<HTMLTextAreaElement>(null);

  // thread가 바뀌면 편집창도 동기화
  useEffect(() => { setEditReply(thread.ai_reply || ''); }, [thread.ai_reply]);

  async function generateReply() {
    setGenerating(true);
    try {
      const res = await fetch('/api/cs/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: thread.id }),
      });
      const data = await res.json();
      if (data.ok) {
        setEditReply(data.reply);
        onUpdate({ ...thread, ai_reply: data.reply, category: data.category, notes: data.summary_kr });
        onToast('✓ AI 답변 초안 생성됨');
      } else {
        onToast('✕ AI 생성 실패');
      }
    } finally {
      setGenerating(false);
    }
  }

  async function copyToClipboard() {
    await navigator.clipboard.writeText(editReply);
    onToast('✓ 클립보드에 복사됨');
  }

  return (
    <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
      {/* 헤더 */}
      <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${CATEGORY_COLOR[thread.category] || CATEGORY_COLOR['기타']}`}>
            {thread.category}
          </span>
          {thread.notes && <span className="text-xs text-stone-500">{thread.notes}</span>}
        </div>
        <span className="text-xs text-stone-400">
          {new Date(thread.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {/* 고객 문의 */}
      <div className="px-5 py-4 border-b border-stone-100">
        <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">고객 문의</p>
        <div className="bg-stone-50 rounded-xl p-3 text-sm text-stone-700 leading-relaxed whitespace-pre-wrap">
          {thread.customer_message}
        </div>
      </div>

      {/* AI 답변 초안 */}
      <div className="px-5 py-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">AI 답변 초안</p>
          <div className="flex items-center gap-2">
            {editReply && (
              <button
                onClick={copyToClipboard}
                className="text-xs text-stone-500 hover:text-stone-700 border border-stone-200 px-2 py-1 rounded-lg"
              >
                복사
              </button>
            )}
            <button
              onClick={generateReply}
              disabled={generating}
              className="text-xs bg-stone-900 text-white px-3 py-1 rounded-lg hover:bg-stone-700 disabled:opacity-50 flex items-center gap-1"
            >
              {generating ? '생성 중...' : thread.ai_reply ? '재생성' : '✨ AI 생성'}
            </button>
          </div>
        </div>

        {generating ? (
          <div className="bg-stone-50 rounded-xl p-3 text-sm text-stone-400 animate-pulse h-24 flex items-center justify-center">
            Claude Haiku가 일본어 답변을 작성 중입니다...
          </div>
        ) : (
          <textarea
            ref={textRef}
            value={editReply}
            onChange={e => setEditReply(e.target.value)}
            placeholder="AI 생성 버튼을 눌러 답변 초안을 생성하세요"
            rows={6}
            className="w-full bg-stone-50 rounded-xl p-3 text-sm text-stone-700 leading-relaxed resize-none border border-transparent focus:border-stone-300 focus:outline-none"
          />
        )}
      </div>

      {/* 액션 버튼 */}
      {thread.status !== 'replied' && (
        <div className="px-5 pb-5 flex items-center gap-3">
          <button
            onClick={() => onAction(thread.id, 'replied', editReply)}
            disabled={!editReply}
            className="flex-1 bg-stone-900 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-stone-700 disabled:opacity-40"
          >
            ✓ 답변 완료 처리
          </button>
          <button
            onClick={() => onAction(thread.id, 'escalated')}
            className="px-4 py-2.5 border border-stone-200 text-stone-600 rounded-xl text-sm hover:bg-stone-50"
          >
            에스컬레이션
          </button>
        </div>
      )}
      {thread.status === 'replied' && (
        <div className="px-5 pb-4 text-sm text-emerald-600 flex items-center gap-2">
          ✓ {thread.replied_at ? new Date(thread.replied_at).toLocaleDateString('ko-KR') : ''} 답변 완료
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// 새 문의 등록 모달
// ──────────────────────────────────────────────
function NewThreadModal({
  onClose,
  onCreated,
  onToast,
}: {
  onClose: () => void;
  onCreated: () => void;
  onToast: (msg: string) => void;
}) {
  const [message, setMessage]       = useState('');
  const [customerName, setName]     = useState('');
  const [orderId, setOrderId]       = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!message.trim()) return;
    setSubmitting(true);
    const res = await fetch('/api/cs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_message: message, customer_name: customerName, order_id: orderId }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (data.ok) {
      onToast('✓ 문의 등록됨');
      onCreated();
    } else {
      onToast('✕ 등록 실패');
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
        <h2 className="text-lg font-bold text-stone-900 mb-4">새 고객 문의 등록</h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-stone-500 block mb-1">고객 문의 (일본어)</label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="BUYMA에서 받은 고객 메시지를 여기에 붙여넣으세요..."
              rows={5}
              className="w-full border border-stone-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:border-stone-400"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-stone-500 block mb-1">고객명 (선택)</label>
              <input
                value={customerName}
                onChange={e => setName(e.target.value)}
                placeholder="고객 닉네임"
                className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-stone-400"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-stone-500 block mb-1">주문번호 (선택)</label>
              <input
                value={orderId}
                onChange={e => setOrderId(e.target.value)}
                placeholder="ORDER-001"
                className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-stone-400"
              />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-5">
          <button onClick={onClose} className="px-4 py-2 text-sm text-stone-600 border border-stone-200 rounded-xl hover:bg-stone-50">
            취소
          </button>
          <button
            onClick={submit}
            disabled={!message.trim() || submitting}
            className="px-4 py-2 text-sm font-semibold bg-stone-900 text-white rounded-xl hover:bg-stone-700 disabled:opacity-50"
          >
            {submitting ? '등록 중...' : '등록하기'}
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyCS({ onNew }: { onNew: () => void }) {
  return (
    <div className="bg-white rounded-2xl border border-stone-200 py-20 text-center">
      <div className="text-5xl mb-4">💬</div>
      <p className="font-semibold text-stone-700 mb-2">등록된 문의가 없습니다</p>
      <p className="text-sm text-stone-400 mb-4">BUYMA에서 받은 고객 메시지를 붙여넣으세요</p>
      <button onClick={onNew} className="bg-stone-900 text-white px-4 py-2 rounded-xl text-sm font-semibold">
        + 새 문의 등록
      </button>
    </div>
  );
}

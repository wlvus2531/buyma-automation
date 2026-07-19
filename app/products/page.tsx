"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  RefreshCw, Sparkles, ExternalLink,
  Search, LayoutGrid, Rows3, Wand2, Languages, Globe2,
  TrendingUp, Check, Loader2, Filter, ThumbsUp, ThumbsDown, RotateCcw,
  Layers, ChevronLeft, ChevronRight, Undo2, Keyboard, X, Image as ImageIcon,
} from "lucide-react";

interface Product {
  id: string;
  name_kr: string;
  name_jp: string | null;
  brand: string | null;
  source_mall: string | null;
  cost_krw: number;
  ship_krw: number;
  list_price_jpy: number | null;
  margin_pct: number | null;
  ai_score: number | null;
  status: string;
  listing_status: string | null;
  skip_reason: string | null;
  decided_at: string | null;
  source_url: string | null;
  thumbnail_url: string | null;
  candidate_id: string | null;
  evidence: Evidence | null;
  created_at: string;
}

// v4 실측 근거 (verify-engine이 승격 시 저장)
interface Evidence {
  source_title?: string;
  cost_ratio?: number;
  inquiry_count?: number | null;
  latest_review_date?: string | null;
  review_count?: number | null;
  wish_count?: number | null;
  access_count?: number | null;
  listed_date?: string | null;
  buyma_price_jpy?: number;
  buyma_url?: string;
  competitor_seller?: string | null;
  source_whitelisted?: boolean;
  margin_before?: number;
  margin_after_refund?: number;
  vat_refund_krw?: number;
  method?: string;
}

/** 등록 경과일 */
function daysSince(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const d = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  return isNaN(d) ? null : d;
}

/** 근거 카드 — 그리드/큐 공용 (v4 P3) */
function EvidenceBlock({ p, compact = false }: { p: Product; compact?: boolean }) {
  const ev = p.evidence;
  if (!ev) return null;
  const days = daysSince(ev.listed_date);
  return (
    <div className={`rounded-xl bg-stone-50 ring-1 ring-stone-100 ${compact ? "p-2.5 text-[11px]" : "p-3 text-xs"} space-y-1.5`}>
      <div className="flex flex-wrap gap-x-3 gap-y-1 font-medium text-stone-700">
        {ev.wish_count != null && <span>❤️ 찜 {ev.wish_count.toLocaleString()}</span>}
        {ev.access_count != null && <span>👁 조회 {ev.access_count.toLocaleString()}</span>}
        {days != null && <span>📅 등록 {days}일차</span>}
        {ev.inquiry_count != null && ev.inquiry_count > 0 && <span>💬 문의 {ev.inquiry_count}건</span>}
        {ev.latest_review_date && (() => {
          const rd = daysSince(ev.latest_review_date);
          return <span className="text-emerald-600">🛒 최근판매 {rd != null ? `${rd}일 전` : ev.latest_review_date}{ev.review_count ? ` (후기 ${ev.review_count})` : ""}</span>;
        })()}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-stone-500">
        {ev.buyma_price_jpy && <span>경쟁가 ¥{ev.buyma_price_jpy.toLocaleString()}</span>}
        {ev.margin_before != null && (
          <span>
            마진 {ev.margin_before}% → <b className="text-emerald-600">환급후 {ev.margin_after_refund}%</b>
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-stone-500">
        <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${ev.source_whitelisted ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}`}>
          {ev.source_whitelisted ? "✓ 신뢰 구매처" : "구매처 확인 필요"}
        </span>
        <span className="truncate max-w-[180px]" title={ev.source_title}>{ev.source_title}</span>
      </div>
      {ev.buyma_url && (
        <a href={ev.buyma_url} target="_blank" rel="noopener noreferrer"
           className="inline-flex items-center gap-1 text-[10px] text-sky-600 hover:underline"
           onClick={(e) => e.stopPropagation()}>
          바이마 경쟁 상품 보기 →
        </a>
      )}
    </div>
  );
}

type PipelineStep = "sourcing" | "scraper" | "translation";
type ViewMode = "grid" | "list" | "queue";
type FilterMode = "all" | "ready" | "pending";
type ActionType = "select" | "skip" | "restore" | "restore_select";

const SKIP_REASONS: { key: string; label: string; short: string }[] = [
  { key: "brand_mismatch", label: "브랜드 안 맞음", short: "브랜드" },
  { key: "price_off",      label: "가격 이상",      short: "가격" },
  { key: "duplicate",      label: "중복 등록",      short: "중복" },
  { key: "low_margin",     label: "마진 부족",      short: "마진" },
  { key: "off_season",     label: "시즌 안 맞음",   short: "시즌" },
  { key: "other",          label: "기타",            short: "기타" },
];

const stepConfig: Record<PipelineStep, { label: string; icon: typeof Wand2; endpoint: string; accent: string }> = {
  sourcing:    { label: "AI 소싱",      icon: Wand2,     endpoint: "/api/sourcing/run",    accent: "from-violet-500 to-fuchsia-500" },
  scraper:     { label: "가격·URL 수집", icon: Globe2,    endpoint: "/api/scraper/run",     accent: "from-sky-500 to-cyan-500" },
  translation: { label: "일본어 번역",   icon: Languages, endpoint: "/api/translation/run", accent: "from-emerald-500 to-teal-500" },
};

interface ToastState {
  msg: string;
  undo?: () => void;
}

interface UndoSnapshot {
  id: string;
  prev: { status: string; listing_status: string | null; skip_reason: string | null; decided_at: string | null };
  action: ActionType;
}

function ScoreRing({ score }: { score: number | null }) {
  if (score == null) return null;
  const tone =
    score >= 90 ? "text-emerald-500 bg-emerald-50 ring-emerald-100" :
    score >= 80 ? "text-sky-500 bg-sky-50 ring-sky-100" :
    "text-amber-500 bg-amber-50 ring-amber-100";
  return (
    <div className={`absolute top-3 right-3 w-9 h-9 rounded-full ring-4 ${tone} flex items-center justify-center font-bold text-xs backdrop-blur-sm shadow-sm`}>
      {score}
    </div>
  );
}

function MarginPill({ pct }: { pct: number | null }) {
  if (pct == null) return <span className="text-xs text-slate-300">—</span>;
  const tone =
    pct >= 25 ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-emerald-200" :
    pct >= 18 ? "bg-gradient-to-r from-sky-500 to-blue-500 text-white shadow-sky-200" :
    pct >= 12 ? "bg-slate-100 text-slate-700" :
    "bg-rose-50 text-rose-500";
  return (
    <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-bold tracking-tight shadow-sm ${tone}`}>
      <TrendingUp size={10} strokeWidth={3} />{pct}%
    </span>
  );
}

// 브랜드/이름 기반 결정적 그라디언트 (같은 입력 → 같은 색)
const PLACEHOLDER_GRADIENTS = [
  "from-violet-400 via-fuchsia-400 to-pink-400",
  "from-sky-400 via-cyan-400 to-teal-400",
  "from-emerald-400 via-teal-400 to-cyan-400",
  "from-amber-400 via-orange-400 to-rose-400",
  "from-indigo-400 via-violet-400 to-purple-400",
  "from-rose-400 via-pink-400 to-fuchsia-400",
  "from-slate-500 via-slate-400 to-stone-400",
  "from-lime-400 via-emerald-400 to-teal-400",
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function getInitial(p: { brand: string | null; name_kr: string }): string {
  const src = p.brand || p.name_kr || "?";
  // 한글이면 첫 글자, 영문이면 첫 영문자만
  const m = src.match(/[A-Za-z]/);
  return (m ? m[0] : src.charAt(0)).toUpperCase();
}

function ProductThumb({
  p, size = "card",
}: { p: Product; size?: "card" | "row" | "queue" }) {
  const [errored, setErrored] = useState(false);
  const showImg = !!p.thumbnail_url && !errored;
  const gradient = PLACEHOLDER_GRADIENTS[hashString(p.brand || p.name_kr) % PLACEHOLDER_GRADIENTS.length];
  const initial = getInitial(p);

  if (showImg) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={p.thumbnail_url!}
        alt={p.name_kr}
        onError={() => setErrored(true)}
        className={size === "row" ? "w-11 h-11 rounded-xl object-cover ring-1 ring-slate-200" : "w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"}
      />
    );
  }

  // Placeholder (그라디언트 + 이니셜)
  const sizing = size === "row" ? "w-11 h-11 rounded-xl text-base" : "w-full h-full text-5xl";
  return (
    <div className={`relative ${sizing} flex items-center justify-center bg-gradient-to-br ${gradient} text-white font-black tracking-tight overflow-hidden`}>
      <span className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.4),transparent)]" />
      <span className="relative drop-shadow-[0_2px_8px_rgba(0,0,0,0.25)]">{initial}</span>
      {size !== "row" && (
        <span className="absolute bottom-2 left-2 right-2 text-[9px] font-bold uppercase tracking-widest text-white/70 truncate text-center">
          {p.brand || "no image"}
        </span>
      )}
    </div>
  );
}

function StatusChip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium ${ok ? "bg-emerald-50 text-emerald-600" : "bg-slate-50 text-slate-400"}`}>
      <span className={`w-1 h-1 rounded-full ${ok ? "bg-emerald-500" : "bg-slate-300"}`} />
      {label}
    </span>
  );
}

// 패스 사유 picker — 인라인 popover (그리드/리스트/큐 공용)
function ReasonPicker({ onPick, onClose }: { onPick: (reason: string) => void; onClose: () => void }) {
  return (
    <div className="absolute inset-x-2 bottom-2 z-20 bg-white rounded-xl shadow-2xl ring-1 ring-slate-900/10 p-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">패스 사유</p>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
          <X size={13} />
        </button>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {SKIP_REASONS.map((r, i) => (
          <button
            key={r.key}
            onClick={() => onPick(r.key)}
            className="inline-flex items-center justify-center gap-1 px-2 py-2 rounded-lg text-[11px] font-semibold text-slate-600 bg-slate-50 hover:bg-rose-50 hover:text-rose-600 transition-colors"
          >
            <span className="text-[9px] text-slate-400 font-bold">{i + 1}</span>
            {r.short}
          </button>
        ))}
      </div>
    </div>
  );
}

function ProductCard({
  p, onAction, pickerOpen, onOpenPicker, onClosePicker,
}: {
  p: Product;
  onAction: (id: string, action: ActionType, reason?: string) => void;
  pickerOpen: boolean;
  onOpenPicker: () => void;
  onClosePicker: () => void;
}) {
  const isSkipped = p.status === "skipped";
  const isSelected = p.listing_status === "pending" || p.listing_status === "approved";
  return (
    <div className={`group relative bg-white rounded-2xl border transition-all duration-300 overflow-hidden flex flex-col ${isSkipped ? "opacity-50 border-slate-200/40" : "border-slate-200/60 hover:border-slate-300 hover:shadow-xl hover:shadow-slate-200/50"}`}>
      <div className="relative aspect-square bg-gradient-to-br from-slate-50 to-slate-100 overflow-hidden">
        <ProductThumb p={p} size="card" />
        <ScoreRing score={p.ai_score} />
        {p.source_url && (
          <a href={p.source_url} target="_blank" rel="noopener noreferrer" className="absolute bottom-3 right-3 w-8 h-8 rounded-full bg-white/90 backdrop-blur-md hover:bg-white shadow-md flex items-center justify-center text-slate-600 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-all" onClick={(e) => e.stopPropagation()}>
            <ExternalLink size={13} />
          </a>
        )}
      </div>

      <div className="p-4 flex-1 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[11px] font-semibold tracking-wide uppercase text-indigo-500">{p.brand ?? "—"}</p>
          <MarginPill pct={p.margin_pct} />
        </div>

        <h3 className="font-semibold text-slate-900 text-sm leading-snug line-clamp-2 min-h-[2.5rem]">{p.name_kr}</h3>
        {p.name_jp && <p className="text-xs text-slate-400 line-clamp-1 -mt-1">{p.name_jp}</p>}

        <div className="flex items-end justify-between mt-auto pt-2 border-t border-slate-100">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">매입</p>
            <p className="text-sm font-bold text-slate-900 tabular-nums">₩{p.cost_krw?.toLocaleString() ?? "—"}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">판매</p>
            <p className="text-sm font-bold text-slate-900 tabular-nums">{p.list_price_jpy ? `¥${p.list_price_jpy.toLocaleString()}` : "—"}</p>
          </div>
        </div>

        <div className="flex gap-1 pt-1">
          <StatusChip ok={!!p.source_url} label="URL" />
          <StatusChip ok={!!p.thumbnail_url} label="이미지" />
          <StatusChip ok={!!p.name_jp} label="번역" />
          {p.skip_reason && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-rose-50 text-rose-500">
              {SKIP_REASONS.find((r) => r.key === p.skip_reason)?.short ?? p.skip_reason}
            </span>
          )}
        </div>

        {/* v4 실측 근거 */}
        <EvidenceBlock p={p} compact />

        {p.candidate_id && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-50 text-indigo-500 self-start">
            📊 실측 소싱
          </span>
        )}

        <div className="flex gap-2 pt-2">
          {isSkipped ? (
            <button onClick={() => onAction(p.id, "restore")} className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs font-semibold text-slate-500 bg-slate-50 hover:bg-slate-100 transition-colors">
              <RotateCcw size={11} /> 복원
            </button>
          ) : (
            <>
              <button
                onClick={() => onAction(p.id, "select")}
                disabled={isSelected}
                className={`flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs font-semibold transition-colors ${isSelected ? "bg-emerald-50 text-emerald-600 cursor-default" : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"}`}
              >
                <ThumbsUp size={11} /> {isSelected ? "선택됨" : "선택"}
              </button>
              <button
                onClick={onOpenPicker}
                className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs font-semibold text-slate-400 bg-slate-50 hover:bg-rose-50 hover:text-rose-500 transition-colors"
              >
                <ThumbsDown size={11} /> 패스
              </button>
            </>
          )}
        </div>
      </div>

      {pickerOpen && (
        <ReasonPicker
          onPick={(reason) => { onAction(p.id, "skip", reason); onClosePicker(); }}
          onClose={onClosePicker}
        />
      )}
    </div>
  );
}

function ProductRow({ p }: { p: Product }) {
  return (
    <tr className="hover:bg-slate-50/70 transition-colors group">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <ProductThumb p={p} size="row" />
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-500">{p.brand ?? "—"}</p>
            <p className="font-semibold text-slate-900 text-sm truncate max-w-[280px]">{p.name_kr}</p>
            {p.name_jp && <p className="text-xs text-slate-400 truncate max-w-[280px]">{p.name_jp}</p>}
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-slate-500">{p.source_mall ?? "—"}</td>
      <td className="px-4 py-3 font-bold text-slate-900 tabular-nums whitespace-nowrap">₩{p.cost_krw?.toLocaleString() ?? "—"}</td>
      <td className="px-4 py-3 font-bold text-slate-900 tabular-nums whitespace-nowrap">{p.list_price_jpy ? `¥${p.list_price_jpy.toLocaleString()}` : "—"}</td>
      <td className="px-4 py-3"><MarginPill pct={p.margin_pct} /></td>
      <td className="px-4 py-3">
        {p.ai_score != null && (
          <span className={`inline-flex items-center justify-center w-9 h-9 rounded-full text-xs font-bold ${
            p.ai_score >= 90 ? "bg-emerald-50 text-emerald-600 ring-2 ring-emerald-100" :
            p.ai_score >= 80 ? "bg-sky-50 text-sky-600 ring-2 ring-sky-100" :
            "bg-amber-50 text-amber-600 ring-2 ring-amber-100"
          }`}>
            {p.ai_score}
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-1">
          <StatusChip ok={!!p.source_url} label="URL" />
          <StatusChip ok={!!p.name_jp} label="JP" />
        </div>
      </td>
      <td className="px-4 py-3">
        {p.source_url && (
          <a href={p.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
            <ExternalLink size={13} />
          </a>
        )}
      </td>
    </tr>
  );
}

// ────────────────────────────────────────────────────────────
// Queue Mode — 한 장씩 결정
// ────────────────────────────────────────────────────────────
function QueueMode({
  items, idx, setIdx, onAction, onExit,
}: {
  items: Product[];
  idx: number;
  setIdx: (n: number | ((i: number) => number)) => void;
  onAction: (id: string, action: ActionType, reason?: string) => void;
  onExit: () => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const current = items[idx];
  const total = items.length;

  // 키보드
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      // 사유 picker가 열려 있으면 숫자 단축키만 활성
      if (pickerOpen) {
        const num = parseInt(e.key, 10);
        if (num >= 1 && num <= SKIP_REASONS.length) {
          e.preventDefault();
          onAction(current.id, "skip", SKIP_REASONS[num - 1].key);
          setPickerOpen(false);
          setIdx((i) => Math.min(i + 1, items.length - 1));
        } else if (e.key === "Escape") {
          setPickerOpen(false);
        }
        return;
      }

      if (e.key === "y" || e.key === "Y" || e.key === "ArrowRight") {
        e.preventDefault();
        if (current) {
          onAction(current.id, "select");
          setIdx((i) => Math.min(i + 1, items.length - 1));
        }
      } else if (e.key === "n" || e.key === "N" || e.key === "ArrowLeft") {
        e.preventDefault();
        if (current) setPickerOpen(true);
      } else if (e.key === "j" || e.key === "J") {
        e.preventDefault();
        setIdx((i) => Math.min(i + 1, items.length - 1));
      } else if (e.key === "k" || e.key === "K") {
        e.preventDefault();
        setIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === "Escape") {
        e.preventDefault();
        onExit();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, items.length, onAction, pickerOpen, setIdx, onExit]);

  if (!current) {
    return (
      <div className="bg-white rounded-2xl ring-1 ring-slate-200/70 py-20 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-500 mb-4">
          <Check size={26} />
        </div>
        <p className="text-base font-semibold text-slate-700">결정할 상품이 없습니다</p>
        <p className="text-sm text-slate-400 mt-1">필터를 변경하거나 그리드 뷰로 돌아가세요</p>
        <button onClick={onExit} className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-slate-900 text-white hover:bg-slate-700">
          그리드로 돌아가기
        </button>
      </div>
    );
  }

  const progress = total > 0 ? ((idx + 1) / total) * 100 : 0;
  const isSkipped = current.status === "skipped";
  const isSelected = current.listing_status === "pending" || current.listing_status === "approved";

  return (
    <div className="bg-white rounded-3xl ring-1 ring-slate-200/70 overflow-hidden">
      {/* 진행률 + 액션 바 */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <button onClick={() => setIdx((i) => Math.max(i - 1, 0))} disabled={idx === 0} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 disabled:opacity-30">
            <ChevronLeft size={16} />
          </button>
          <div className="text-sm font-bold text-slate-900 tabular-nums">{idx + 1} / {total}</div>
          <button onClick={() => setIdx((i) => Math.min(i + 1, total - 1))} disabled={idx >= total - 1} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 disabled:opacity-30">
            <ChevronRight size={16} />
          </button>
        </div>
        <div className="hidden md:flex items-center gap-2 text-[11px] text-slate-400">
          <Keyboard size={12} />
          <kbd className="px-1.5 py-0.5 rounded bg-slate-100 font-mono">Y</kbd> 선택
          <kbd className="px-1.5 py-0.5 rounded bg-slate-100 font-mono">N</kbd> 패스
          <kbd className="px-1.5 py-0.5 rounded bg-slate-100 font-mono">J/K</kbd> 이동
          <kbd className="px-1.5 py-0.5 rounded bg-slate-100 font-mono">Esc</kbd> 닫기
        </div>
        <button onClick={onExit} className="text-slate-400 hover:text-slate-700">
          <X size={16} />
        </button>
      </div>
      {/* 진행률 바 */}
      <div className="h-1 bg-slate-100">
        <div className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>

      {/* 메인 카드 */}
      <div className="grid md:grid-cols-2 gap-0 relative">
        {/* 이미지 */}
        <div className="relative aspect-square md:aspect-auto bg-gradient-to-br from-slate-50 to-slate-100 overflow-hidden">
          <ProductThumb p={current} size="queue" />
          <ScoreRing score={current.ai_score} />
        </div>

        {/* 메타 + 액션 */}
        <div className="p-8 flex flex-col gap-4">
          <div className="flex items-start justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 text-[11px] font-semibold text-indigo-600 uppercase tracking-wider">
              {current.brand ?? "브랜드 미지정"}
            </span>
            <MarginPill pct={current.margin_pct} />
          </div>

          <h2 className="text-2xl font-bold tracking-tight text-slate-900 leading-tight">{current.name_kr}</h2>
          {current.name_jp && <p className="text-sm text-slate-500 -mt-2">{current.name_jp}</p>}

          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">매입가</p>
              <p className="text-xl font-bold text-slate-900 tabular-nums mt-1">₩{current.cost_krw?.toLocaleString() ?? "—"}</p>
              {current.ship_krw > 0 && <p className="text-[11px] text-slate-400 mt-0.5">+ 배송 ₩{current.ship_krw.toLocaleString()}</p>}
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">판매가</p>
              <p className="text-xl font-bold text-slate-900 tabular-nums mt-1">{current.list_price_jpy ? `¥${current.list_price_jpy.toLocaleString()}` : "—"}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">{current.source_mall ?? "—"}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <StatusChip ok={!!current.source_url} label="URL 수집" />
            <StatusChip ok={!!current.thumbnail_url} label="이미지" />
            <StatusChip ok={!!current.name_jp} label="일본어 번역" />
            {current.source_url && (
              <a href={current.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold text-indigo-600 hover:bg-indigo-50">
                <ExternalLink size={10} /> 원본
              </a>
            )}
            {current.skip_reason && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-rose-50 text-rose-500">
                패스 사유: {SKIP_REASONS.find((r) => r.key === current.skip_reason)?.label ?? current.skip_reason}
              </span>
            )}
          </div>

          {/* v4 실측 근거 — 결정의 핵심 정보 */}
          <EvidenceBlock p={current} />

          {/* 액션 버튼 */}
          <div className="flex gap-3 mt-auto pt-4">
            {isSkipped ? (
              <button onClick={() => { onAction(current.id, "restore"); }} className="flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors">
                <RotateCcw size={14} /> 복원
              </button>
            ) : (
              <>
                <button
                  onClick={() => { onAction(current.id, "select"); setIdx((i) => Math.min(i + 1, items.length - 1)); }}
                  disabled={isSelected}
                  className={`flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold transition-all ${isSelected ? "bg-emerald-50 text-emerald-600 cursor-default" : "bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:shadow-lg hover:shadow-emerald-200"}`}
                >
                  <ThumbsUp size={15} /> {isSelected ? "이미 선택됨" : "선택 (Y)"}
                </button>
                <button onClick={() => setPickerOpen(true)} className="flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold text-slate-700 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 transition-colors">
                  <ThumbsDown size={15} /> 패스 (N)
                </button>
              </>
            )}
          </div>
        </div>

        {pickerOpen && (
          <div className="absolute inset-x-6 bottom-6 z-30">
            <ReasonPicker
              onPick={(reason) => {
                onAction(current.id, "skip", reason);
                setPickerOpen(false);
                setIdx((i) => Math.min(i + 1, items.length - 1));
              }}
              onClose={() => setPickerOpen(false)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────
export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<PipelineStep | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [view, setView] = useState<ViewMode>("grid");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterMode>("all");
  const [showSkipped, setShowSkipped] = useState(false);
  const [queueIdx, setQueueIdx] = useState(0);
  const [gridPickerFor, setGridPickerFor] = useState<string | null>(null);
  const [refreshingThumbs, setRefreshingThumbs] = useState(false);
  const lastSnapshotRef = useRef<UndoSnapshot | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/products");
    const data = await res.json();
    setProducts(data.products ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // toast 자동 사라짐
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  async function refreshThumbnails() {
    setRefreshingThumbs(true);
    try {
      const res = await fetch("/api/scraper/run?mode=thumbnails", { method: "POST" });
      const data = await res.json();
      if (!data.ok) {
        setToast({ msg: `✕ 썸네일 재수집: ${data.error ?? "실행 실패"}` });
      } else {
        setToast({ msg: `✓ 썸네일 ${data.updated}개 재수집 (실패 ${data.failed}, 미발견 ${data.skipped})` });
      }
      await load();
    } catch {
      setToast({ msg: "✕ 썸네일 재수집 실패" });
    } finally {
      setRefreshingThumbs(false);
    }
  }

  async function runPipeline(step: PipelineStep) {
    setRunning(step);
    try {
      const res = await fetch(stepConfig[step].endpoint, { method: "POST" });
      const data = await res.json();
      if (!data.ok) {
        setToast({ msg: `✕ ${stepConfig[step].label}: ${data.error ?? "실행 실패"}` });
      } else if (step === "sourcing") setToast({ msg: `✓ ${data.saved}개 신규 소싱 완료` });
      else if (step === "scraper") setToast({ msg: `✓ ${data.updated}개 가격/URL 수집` });
      else setToast({ msg: `✓ ${data.translated}개 번역 완료` });
      await load();
    } catch {
      setToast({ msg: `✕ ${stepConfig[step].label} 실행 실패` });
    } finally {
      setRunning(null);
    }
  }

  // 액션 처리 + Undo 스냅샷 + 토스트
  const handleAction = useCallback(async (id: string, action: ActionType, reason?: string) => {
    const product = products.find((p) => p.id === id);
    if (!product) return;

    // 스냅샷 (이후 Undo 시 복원용)
    if (action === "select" || action === "skip") {
      lastSnapshotRef.current = {
        id,
        action,
        prev: {
          status: product.status,
          listing_status: product.listing_status,
          skip_reason: product.skip_reason,
          decided_at: product.decided_at,
        },
      };
    }

    // Optimistic update
    setProducts((prev) => prev.map((p) => {
      if (p.id !== id) return p;
      const now = new Date().toISOString();
      if (action === "skip") return { ...p, status: "skipped", skip_reason: reason ?? null, decided_at: now };
      if (action === "select") return { ...p, listing_status: "pending", decided_at: now };
      if (action === "restore") return { ...p, status: "active", skip_reason: null, decided_at: null };
      if (action === "restore_select") return { ...p, listing_status: null, decided_at: null };
      return p;
    }));

    // API
    const res = await fetch("/api/products", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action, reason }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) {
      // 롤백: optimistic update 되돌리기
      setProducts((prev) => prev.map((p) => p.id === id ? product : p));
      setToast({ msg: `✕ 저장 실패: ${data.error ?? res.statusText}` });
      return;
    }

    // Undo 토스트
    if (action === "select" || action === "skip") {
      const reasonLabel = reason ? SKIP_REASONS.find((r) => r.key === reason)?.label : null;
      const msg = action === "select" ? "✓ 등록 워크플로우에 추가" : `패스됨${reasonLabel ? ` · ${reasonLabel}` : ""}`;
      setToast({
        msg,
        undo: () => {
          const snap = lastSnapshotRef.current;
          if (!snap || snap.id !== id) return;
          const reverseAction = snap.action === "select" ? "restore_select" : "restore";
          handleAction(id, reverseAction);
          setToast(null);
        },
      });
    }
  }, [products]);

  const stats = useMemo(() => {
    const total = products.length;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const decidedToday = products.filter((p) => p.decided_at && new Date(p.decided_at) >= todayStart);
    const selectedToday = decidedToday.filter((p) => p.listing_status && p.listing_status !== "none").length;
    const skippedToday = decidedToday.filter((p) => p.status === "skipped").length;
    return {
      total,
      withUrl: products.filter((p) => p.source_url).length,
      withJp: products.filter((p) => p.name_jp).length,
      withThumb: products.filter((p) => p.thumbnail_url).length,
      avgScore: total ? Math.round(products.reduce((a, p) => a + (p.ai_score ?? 0), 0) / total) : 0,
      decidedToday: decidedToday.length,
      selectedToday,
      skippedToday,
      pending: products.filter((p) => p.status !== "skipped" && (!p.listing_status || p.listing_status === "none")).length,
    };
  }, [products]);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (!showSkipped && p.status === "skipped") return false;
      const q = search.toLowerCase();
      const matchSearch = !q ||
        p.name_kr.toLowerCase().includes(q) ||
        (p.brand?.toLowerCase().includes(q) ?? false) ||
        (p.name_jp?.toLowerCase().includes(q) ?? false);
      const ready = !!p.source_url && !!p.name_jp;
      const matchFilter = filter === "all" || (filter === "ready" && ready) || (filter === "pending" && !ready);
      return matchSearch && matchFilter;
    });
  }, [products, search, filter, showSkipped]);

  // queue 모드 진입 시 인덱스 보정
  useEffect(() => {
    if (queueIdx >= filtered.length) setQueueIdx(Math.max(filtered.length - 1, 0));
  }, [filtered.length, queueIdx]);

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-violet-50 to-indigo-50 ring-1 ring-violet-100 text-[11px] font-semibold text-violet-700 uppercase tracking-wider">
              <Sparkles size={11} strokeWidth={2.5} />
              AI 자동화
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">소싱 상품</h1>
          <p className="text-sm text-slate-500 mt-1.5">매일 새벽 AI가 자동 발굴 → 운영자가 결정 → 등록 워크플로우</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} disabled={loading} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-slate-600 bg-white ring-1 ring-slate-200 hover:bg-slate-50 hover:ring-slate-300 transition-all disabled:opacity-50">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />새로고침
          </button>
          <a href="/register" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-stone-900 text-white hover:bg-stone-700 transition-colors shadow-sm">
            등록 워크플로우 →
          </a>
        </div>
      </header>

      {/* 오늘 진행률 */}
      <div className="flex items-center gap-2 flex-wrap bg-gradient-to-r from-violet-50/60 to-fuchsia-50/60 rounded-2xl p-3 ring-1 ring-violet-100/50">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white ring-1 ring-violet-200 text-[11px] font-bold text-violet-700">오늘</span>
        <span className="text-xs text-slate-500">결정함</span>
        <span className="text-sm font-bold text-slate-900 tabular-nums">{stats.decidedToday}</span>
        <span className="text-slate-300">·</span>
        <span className="text-xs text-slate-500">선택</span>
        <span className="text-sm font-bold text-emerald-600 tabular-nums">{stats.selectedToday}</span>
        <span className="text-slate-300">·</span>
        <span className="text-xs text-slate-500">패스</span>
        <span className="text-sm font-bold text-rose-500 tabular-nums">{stats.skippedToday}</span>
        <span className="text-slate-300">·</span>
        <span className="text-xs text-slate-500">미결정</span>
        <span className="text-sm font-bold text-slate-900 tabular-nums">{stats.pending}</span>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "전체 상품", value: stats.total, sub: "AI 추천", tone: "from-violet-500 to-indigo-500" },
          { label: "URL 수집", value: stats.withUrl, sub: `${stats.total ? Math.round(stats.withUrl / stats.total * 100) : 0}%`, tone: "from-sky-500 to-cyan-500" },
          { label: "일본어 번역", value: stats.withJp, sub: `${stats.total ? Math.round(stats.withJp / stats.total * 100) : 0}%`, tone: "from-emerald-500 to-teal-500" },
          { label: "평균 AI 점수", value: stats.avgScore, sub: "100점 만점", tone: "from-amber-500 to-orange-500" },
        ].map((s) => (
          <div key={s.label} className="relative bg-white rounded-2xl ring-1 ring-slate-200/70 p-5 overflow-hidden hover:ring-slate-300 transition-all">
            <div className={`absolute -top-10 -right-10 w-24 h-24 rounded-full bg-gradient-to-br ${s.tone} opacity-10 blur-2xl`} />
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{s.label}</p>
            <p className="text-3xl font-bold tracking-tight text-slate-900 mt-2 tabular-nums">{s.value}</p>
            <p className="text-xs text-slate-400 mt-1">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* 파이프라인 */}
      <div className="bg-white rounded-2xl ring-1 ring-slate-200/70 p-2 flex items-center gap-2 flex-wrap">
        <p className="text-xs font-semibold text-slate-500 px-3">파이프라인</p>
        <div className="h-5 w-px bg-slate-200" />
        {(Object.keys(stepConfig) as PipelineStep[]).map((step, i) => {
          const Icon = stepConfig[step].icon;
          const isRunning = running === step;
          const disabled = running !== null;
          return (
            <button
              key={step}
              onClick={() => runPipeline(step)}
              disabled={disabled}
              className={`group relative inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${isRunning ? `bg-gradient-to-r ${stepConfig[step].accent} text-white shadow-md` : "text-slate-700 hover:bg-slate-50"}`}
            >
              <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${isRunning ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500 group-hover:bg-white"}`}>
                {i + 1}
              </span>
              {isRunning ? <Loader2 size={14} className="animate-spin" /> : <Icon size={14} />}
              {stepConfig[step].label}
            </button>
          );
        })}
        <div className="h-5 w-px bg-slate-200" />
        <button
          onClick={refreshThumbnails}
          disabled={refreshingThumbs || running !== null}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          title="썸네일이 비어있는 상품에 대해 네이버 검색 재시도 (광범위 쿼리)"
        >
          {refreshingThumbs ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />}
          썸네일 재수집
        </button>
      </div>

      {/* 검색 + 필터 + 뷰 토글 */}
      {view !== "queue" && (
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[260px]">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="상품명, 브랜드 검색..." className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm bg-white ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-400 focus:outline-none transition-all" />
          </div>

          <div className="inline-flex items-center bg-white ring-1 ring-slate-200 rounded-xl p-1">
            {([
              { v: "all", label: "전체", icon: Filter },
              { v: "ready", label: "완료", icon: Check },
              { v: "pending", label: "진행중", icon: Loader2 },
            ] as const).map(({ v, label, icon: Icon }) => (
              <button key={v} onClick={() => setFilter(v)} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${filter === v ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                <Icon size={12} />{label}
              </button>
            ))}
          </div>

          <button onClick={() => setShowSkipped((v) => !v)} className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold ring-1 transition-all ${showSkipped ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-500 ring-slate-200 hover:text-slate-700"}`}>
            <ThumbsDown size={12} /> 패스 {showSkipped ? "숨기기" : "보기"}
          </button>

          <div className="inline-flex items-center bg-white ring-1 ring-slate-200 rounded-xl p-1">
            <button onClick={() => setView("grid")} className={`inline-flex items-center justify-center w-8 h-8 rounded-lg transition-all ${view === "grid" ? "bg-slate-900 text-white" : "text-slate-400 hover:text-slate-700"}`}>
              <LayoutGrid size={14} />
            </button>
            <button onClick={() => setView("list")} className={`inline-flex items-center justify-center w-8 h-8 rounded-lg transition-all ${view === "list" ? "bg-slate-900 text-white" : "text-slate-400 hover:text-slate-700"}`}>
              <Rows3 size={14} />
            </button>
            <button
              onClick={() => { setView("queue"); setQueueIdx(0); }}
              className="inline-flex items-center justify-center gap-1 px-2 h-8 rounded-lg transition-all text-slate-400 hover:text-slate-700"
              title="결정 큐 모드"
            >
              <Layers size={14} /> <span className="text-[11px] font-semibold">큐</span>
            </button>
          </div>
        </div>
      )}

      {/* 콘텐츠 */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl ring-1 ring-slate-200/70 overflow-hidden">
              <div className="aspect-square bg-slate-100 animate-pulse" />
              <div className="p-4 space-y-2">
                <div className="h-3 bg-slate-100 rounded w-1/3 animate-pulse" />
                <div className="h-4 bg-slate-100 rounded animate-pulse" />
                <div className="h-4 bg-slate-100 rounded w-2/3 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : view === "queue" ? (
        <QueueMode
          items={filtered}
          idx={queueIdx}
          setIdx={setQueueIdx}
          onAction={handleAction}
          onExit={() => setView("grid")}
        />
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl ring-1 ring-slate-200/70 py-20 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-50 text-slate-300 mb-4">
            <Sparkles size={26} strokeWidth={1.5} />
          </div>
          <p className="text-base font-semibold text-slate-700">{search || filter !== "all" ? "조건에 맞는 상품이 없습니다" : "AI 소싱을 시작하세요"}</p>
          <p className="text-sm text-slate-400 mt-1">{search || filter !== "all" ? "검색어나 필터를 변경해 보세요" : "위 ① AI 소싱 버튼을 눌러 30개 상품을 발굴합니다"}</p>
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((p) => (
            <ProductCard
              key={p.id}
              p={p}
              onAction={handleAction}
              pickerOpen={gridPickerFor === p.id}
              onOpenPicker={() => setGridPickerFor(p.id)}
              onClosePicker={() => setGridPickerFor(null)}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl ring-1 ring-slate-200/70 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50/70 border-b border-slate-100">
                <tr>
                  {["상품", "구매처", "매입가", "판매가", "마진", "AI", "상태", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-bold tracking-wider text-slate-500 uppercase whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((p) => <ProductRow key={p.id} p={p} />)}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Undo 토스트 */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 inline-flex items-center gap-3 px-4 py-3 rounded-2xl bg-slate-900 text-white text-sm font-medium shadow-2xl ring-1 ring-white/10 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <span>{toast.msg}</span>
          {toast.undo && (
            <button
              onClick={() => { toast.undo!(); }}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold transition-colors"
            >
              <Undo2 size={12} /> 되돌리기
            </button>
          )}
          <button onClick={() => setToast(null)} className="text-white/50 hover:text-white">
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

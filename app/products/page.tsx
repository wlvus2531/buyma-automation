"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  RefreshCw, Sparkles, ExternalLink, ImageOff,
  Search, LayoutGrid, Rows3, Wand2, Languages, Globe2,
  TrendingUp, Check, Loader2, Filter,
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
  source_url: string | null;
  thumbnail_url: string | null;
  created_at: string;
}

type PipelineStep = "sourcing" | "scraper" | "translation";
type ViewMode = "grid" | "list";
type FilterMode = "all" | "ready" | "pending";

const stepConfig: Record<PipelineStep, { label: string; icon: typeof Wand2; endpoint: string; accent: string }> = {
  sourcing:    { label: "AI 소싱",      icon: Wand2,     endpoint: "/api/sourcing/run",    accent: "from-violet-500 to-fuchsia-500" },
  scraper:     { label: "가격·URL 수집", icon: Globe2,    endpoint: "/api/scraper/run",     accent: "from-sky-500 to-cyan-500" },
  translation: { label: "일본어 번역",   icon: Languages, endpoint: "/api/translation/run", accent: "from-emerald-500 to-teal-500" },
};

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

function StatusChip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium ${ok ? "bg-emerald-50 text-emerald-600" : "bg-slate-50 text-slate-400"}`}>
      <span className={`w-1 h-1 rounded-full ${ok ? "bg-emerald-500" : "bg-slate-300"}`} />
      {label}
    </span>
  );
}

function ProductCard({ p }: { p: Product }) {
  return (
    <div className="group relative bg-white rounded-2xl border border-slate-200/60 hover:border-slate-300 hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-300 overflow-hidden flex flex-col">
      {/* 썸네일 */}
      <div className="relative aspect-square bg-gradient-to-br from-slate-50 to-slate-100 overflow-hidden">
        {p.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={p.thumbnail_url}
            alt={p.name_kr}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300">
            <ImageOff size={32} strokeWidth={1.5} />
          </div>
        )}
        <ScoreRing score={p.ai_score} />
        {p.source_url && (
          <a
            href={p.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute bottom-3 right-3 w-8 h-8 rounded-full bg-white/90 backdrop-blur-md hover:bg-white shadow-md flex items-center justify-center text-slate-600 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink size={13} />
          </a>
        )}
      </div>

      {/* 본문 */}
      <div className="p-4 flex-1 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[11px] font-semibold tracking-wide uppercase text-indigo-500">
            {p.brand ?? "—"}
          </p>
          <MarginPill pct={p.margin_pct} />
        </div>

        <h3 className="font-semibold text-slate-900 text-sm leading-snug line-clamp-2 min-h-[2.5rem]">
          {p.name_kr}
        </h3>

        {p.name_jp && (
          <p className="text-xs text-slate-400 line-clamp-1 -mt-1">{p.name_jp}</p>
        )}

        <div className="flex items-end justify-between mt-auto pt-2 border-t border-slate-100">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">매입</p>
            <p className="text-sm font-bold text-slate-900 tabular-nums">
              ₩{p.cost_krw?.toLocaleString() ?? "—"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">판매</p>
            <p className="text-sm font-bold text-slate-900 tabular-nums">
              {p.list_price_jpy ? `¥${p.list_price_jpy.toLocaleString()}` : "—"}
            </p>
          </div>
        </div>

        <div className="flex gap-1 pt-1">
          <StatusChip ok={!!p.source_url} label="URL" />
          <StatusChip ok={!!p.thumbnail_url} label="이미지" />
          <StatusChip ok={!!p.name_jp} label="번역" />
        </div>
      </div>
    </div>
  );
}

function ProductRow({ p }: { p: Product }) {
  return (
    <tr className="hover:bg-slate-50/70 transition-colors group">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          {p.thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.thumbnail_url} alt="" className="w-11 h-11 rounded-xl object-cover ring-1 ring-slate-200" />
          ) : (
            <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center text-slate-300">
              <ImageOff size={14} />
            </div>
          )}
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-500">{p.brand ?? "—"}</p>
            <p className="font-semibold text-slate-900 text-sm truncate max-w-[280px]">{p.name_kr}</p>
            {p.name_jp && <p className="text-xs text-slate-400 truncate max-w-[280px]">{p.name_jp}</p>}
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-slate-500">{p.source_mall ?? "—"}</td>
      <td className="px-4 py-3 font-bold text-slate-900 tabular-nums whitespace-nowrap">
        ₩{p.cost_krw?.toLocaleString() ?? "—"}
      </td>
      <td className="px-4 py-3 font-bold text-slate-900 tabular-nums whitespace-nowrap">
        {p.list_price_jpy ? `¥${p.list_price_jpy.toLocaleString()}` : "—"}
      </td>
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
          <a
            href={p.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
          >
            <ExternalLink size={13} />
          </a>
        )}
      </td>
    </tr>
  );
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<PipelineStep | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>("grid");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterMode>("all");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/products");
    const data = await res.json();
    setProducts(data.products ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  async function runPipeline(step: PipelineStep) {
    setRunning(step);
    try {
      const res = await fetch(stepConfig[step].endpoint, { method: "POST" });
      const data = await res.json();
      if (!data.ok) {
        setToast(`✕ ${stepConfig[step].label}: ${data.error ?? "실행 실패"}`);
      } else if (step === "sourcing") setToast(`✓ ${data.saved}개 신규 소싱 완료`);
      else if (step === "scraper") setToast(`✓ ${data.updated}개 가격/URL 수집`);
      else setToast(`✓ ${data.translated}개 번역 완료`);
      await load();
    } catch {
      setToast(`✕ ${stepConfig[step].label} 실행 실패`);
    } finally {
      setRunning(null);
    }
  }

  const stats = useMemo(() => {
    const total = products.length;
    return {
      total,
      withUrl: products.filter((p) => p.source_url).length,
      withJp: products.filter((p) => p.name_jp).length,
      withThumb: products.filter((p) => p.thumbnail_url).length,
      avgScore: total ? Math.round(products.reduce((a, p) => a + (p.ai_score ?? 0), 0) / total) : 0,
    };
  }, [products]);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const q = search.toLowerCase();
      const matchSearch = !q ||
        p.name_kr.toLowerCase().includes(q) ||
        (p.brand?.toLowerCase().includes(q) ?? false) ||
        (p.name_jp?.toLowerCase().includes(q) ?? false);
      const ready = !!p.source_url && !!p.name_jp;
      const matchFilter = filter === "all" || (filter === "ready" && ready) || (filter === "pending" && !ready);
      return matchSearch && matchFilter;
    });
  }, [products, search, filter]);

  return (
    <div className="space-y-8">
      {/* 헤더 */}
      <header className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-violet-50 to-indigo-50 ring-1 ring-violet-100 text-[11px] font-semibold text-violet-700 uppercase tracking-wider">
              <Sparkles size={11} strokeWidth={2.5} />
              AI 자동화
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">소싱 상품</h1>
          <p className="text-sm text-slate-500 mt-1.5">
            매일 새벽 AI가 자동으로 발굴한 상품 — 가격·이미지·번역까지 한 번에
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-slate-600 bg-white ring-1 ring-slate-200 hover:bg-slate-50 hover:ring-slate-300 transition-all disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            새로고침
          </button>
          <a
            href="/register"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-stone-900 text-white hover:bg-stone-700 transition-colors shadow-sm"
          >
            등록 워크플로우 →
          </a>
        </div>
      </header>

      {/* 통계 */}
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

      {/* 파이프라인 액션 바 */}
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
        {toast && (
          <div className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-medium animate-in fade-in slide-in-from-right-2 duration-300">
            {toast}
          </div>
        )}
      </div>

      {/* 검색 + 필터 + 뷰 토글 */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[260px]">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="상품명, 브랜드 검색..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm bg-white ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-400 focus:outline-none transition-all"
          />
        </div>

        <div className="inline-flex items-center bg-white ring-1 ring-slate-200 rounded-xl p-1">
          {([
            { v: "all", label: "전체", icon: Filter },
            { v: "ready", label: "완료", icon: Check },
            { v: "pending", label: "진행중", icon: Loader2 },
          ] as const).map(({ v, label, icon: Icon }) => (
            <button
              key={v}
              onClick={() => setFilter(v)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${filter === v ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              <Icon size={12} />
              {label}
            </button>
          ))}
        </div>

        <div className="inline-flex items-center bg-white ring-1 ring-slate-200 rounded-xl p-1">
          <button
            onClick={() => setView("grid")}
            className={`inline-flex items-center justify-center w-8 h-8 rounded-lg transition-all ${view === "grid" ? "bg-slate-900 text-white" : "text-slate-400 hover:text-slate-700"}`}
          >
            <LayoutGrid size={14} />
          </button>
          <button
            onClick={() => setView("list")}
            className={`inline-flex items-center justify-center w-8 h-8 rounded-lg transition-all ${view === "list" ? "bg-slate-900 text-white" : "text-slate-400 hover:text-slate-700"}`}
          >
            <Rows3 size={14} />
          </button>
        </div>
      </div>

      {/* 콘텐츠 */}
      {loading ? (
        <div className={view === "grid" ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4" : "space-y-2"}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className={view === "grid" ? "bg-white rounded-2xl ring-1 ring-slate-200/70 overflow-hidden" : "bg-white rounded-xl ring-1 ring-slate-200/70 h-16"}>
              {view === "grid" && (
                <>
                  <div className="aspect-square bg-slate-100 animate-pulse" />
                  <div className="p-4 space-y-2">
                    <div className="h-3 bg-slate-100 rounded w-1/3 animate-pulse" />
                    <div className="h-4 bg-slate-100 rounded animate-pulse" />
                    <div className="h-4 bg-slate-100 rounded w-2/3 animate-pulse" />
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl ring-1 ring-slate-200/70 py-20 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-50 text-slate-300 mb-4">
            <Sparkles size={26} strokeWidth={1.5} />
          </div>
          <p className="text-base font-semibold text-slate-700">
            {search || filter !== "all" ? "조건에 맞는 상품이 없습니다" : "AI 소싱을 시작하세요"}
          </p>
          <p className="text-sm text-slate-400 mt-1">
            {search || filter !== "all" ? "검색어나 필터를 변경해 보세요" : "위 ① AI 소싱 버튼을 눌러 30개 상품을 발굴합니다"}
          </p>
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((p) => <ProductCard key={p.id} p={p} />)}
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
    </div>
  );
}

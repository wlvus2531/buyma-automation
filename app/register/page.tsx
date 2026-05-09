"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ClipboardList, RefreshCw, CheckCircle2, XCircle, PackageCheck,
  ChevronDown, ChevronUp, ExternalLink, ImageOff, Loader2,
  Sparkles, Tag, Store, Wand2,
} from "lucide-react";

interface ListingProduct {
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
  thumbnail_url: string | null;
  source_url: string | null;
  listing_status: string | null;
  title_jp: string | null;
  description_jp: string | null;
  buyma_category: string | null;
  listing_tags: string[] | null;
  listed_at: string | null;
  buyma_listing_url?: string | null;
}

type TabKey = "ready" | "approved" | "listed" | "rejected";

const TABS: { key: TabKey; label: string; accent: string }[] = [
  { key: "ready",    label: "승인 대기",  accent: "text-amber-600 border-amber-500" },
  { key: "approved", label: "등록 예정",  accent: "text-indigo-600 border-indigo-500" },
  { key: "listed",   label: "등록 완료",  accent: "text-emerald-600 border-emerald-500" },
  { key: "rejected", label: "거절",       accent: "text-rose-600 border-rose-500" },
];

function MarginBadge({ pct }: { pct: number | null }) {
  if (pct == null) return <span className="text-slate-300 text-xs">—</span>;
  const cls =
    pct >= 25 ? "bg-emerald-50 text-emerald-700 ring-emerald-200" :
    pct >= 18 ? "bg-sky-50 text-sky-700 ring-sky-200" :
    pct >= 12 ? "bg-slate-100 text-slate-600 ring-slate-200" :
    "bg-rose-50 text-rose-600 ring-rose-200";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ring-1 ${cls}`}>
      마진 {pct}%
    </span>
  );
}

function TagList({ tags }: { tags: string[] | null }) {
  if (!tags?.length) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-2">
      {tags.map((t) => (
        <span key={t} className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-600 text-[10px] font-medium">
          <Tag size={9} strokeWidth={2.5} />{t}
        </span>
      ))}
    </div>
  );
}

function ProductCard({
  p,
  onAction,
  acting,
}: {
  p: ListingProduct;
  onAction: (id: string, action: "approve" | "reject" | "listed") => void;
  acting: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const isActing = acting === p.id;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 hover:border-slate-300 hover:shadow-lg hover:shadow-slate-200/40 transition-all duration-200 overflow-hidden">
      <div className="flex gap-4 p-4">
        {/* 썸네일 */}
        <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-slate-50 flex items-center justify-center">
          {p.thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.thumbnail_url} alt={p.name_kr} className="w-full h-full object-cover" />
          ) : (
            <ImageOff size={20} className="text-slate-300" />
          )}
        </div>

        {/* 메인 정보 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-500 mb-0.5">
                {p.brand ?? "—"} · {p.source_mall ?? "—"}
              </p>
              <h3 className="font-semibold text-slate-900 text-sm leading-snug">{p.name_kr}</h3>
              {p.title_jp && (
                <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{p.title_jp}</p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {p.ai_score != null && (
                <span className={`inline-flex items-center justify-center w-9 h-9 rounded-full text-xs font-bold ring-2 ${
                  p.ai_score >= 90 ? "bg-emerald-50 text-emerald-600 ring-emerald-100" :
                  p.ai_score >= 80 ? "bg-sky-50 text-sky-600 ring-sky-100" :
                  "bg-amber-50 text-amber-600 ring-amber-100"
                }`}>
                  {p.ai_score}
                </span>
              )}
              <MarginBadge pct={p.margin_pct} />
            </div>
          </div>

          <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
            <span>₩{p.cost_krw?.toLocaleString()}</span>
            <span className="text-slate-300">·</span>
            <span>{p.list_price_jpy ? `¥${p.list_price_jpy.toLocaleString()}` : "—"}</span>
            {p.buyma_category && (
              <>
                <span className="text-slate-300">·</span>
                <span className="flex items-center gap-1 text-slate-400">
                  <Store size={10} />{p.buyma_category}
                </span>
              </>
            )}
          </div>

          <TagList tags={p.listing_tags} />
        </div>
      </div>

      {/* 펼쳐보기 (description_jp) */}
      {p.description_jp && (
        <>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-2 border-t border-slate-100 text-xs font-medium text-slate-500 hover:bg-slate-50 transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <Sparkles size={11} className="text-violet-400" />
              AI 생성 상품 설명 보기
            </span>
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          {expanded && (
            <div className="px-4 pb-4 text-xs text-slate-600 whitespace-pre-line leading-relaxed bg-slate-50/50 border-t border-slate-100">
              {p.description_jp}
            </div>
          )}
        </>
      )}

      {/* 액션 버튼 */}
      {(p.listing_status === "ready" || p.listing_status === "approved") && (
        <div className="flex items-center gap-2 px-4 pb-4 pt-2 border-t border-slate-100 flex-wrap">
          {p.source_url && (
            <a
              href={p.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 bg-white ring-1 ring-slate-200 hover:ring-slate-300 hover:bg-slate-50 transition-all"
            >
              <ExternalLink size={12} />구매처
            </a>
          )}

          {p.listing_status === "ready" && (
            <>
              <button
                disabled={isActing}
                onClick={() => onAction(p.id, "approve")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                {isActing ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                승인
              </button>
              <button
                disabled={isActing}
                onClick={() => onAction(p.id, "reject")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 transition-colors disabled:opacity-50"
              >
                <XCircle size={12} />거절
              </button>
            </>
          )}

          {p.listing_status === "approved" && (
            <>
              <a
                href="https://www.buyma.com/buyer/mypage/item_add.html"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200 hover:bg-indigo-100 transition-all"
                title="Chrome 확장이 설치되어 있으면 폼이 자동으로 채워집니다"
              >
                <Wand2 size={12} />
                BUYMA에서 자동 입력
              </a>
              <button
                disabled={isActing}
                onClick={() => onAction(p.id, "listed")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                {isActing ? <Loader2 size={12} className="animate-spin" /> : <PackageCheck size={12} />}
                등록 완료
              </button>
            </>
          )}
        </div>
      )}

      {p.listing_status === "listed" && p.listed_at && (
        <div className="px-4 pb-3 text-[11px] text-emerald-600 flex items-center gap-3 border-t border-slate-100 pt-2">
          <span className="flex items-center gap-1.5">
            <PackageCheck size={11} />
            {new Date(p.listed_at).toLocaleDateString("ko-KR")} 등록 완료
          </span>
          {p.buyma_listing_url && (
            <a
              href={p.buyma_listing_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-indigo-600 hover:underline"
            >
              <ExternalLink size={10} />바이마 페이지
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export default function RegisterPage() {
  const [tab, setTab] = useState<TabKey>("ready");
  const [products, setProducts] = useState<ListingProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [preparing, setPreparing] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async (t: TabKey) => {
    setLoading(true);
    const res = await fetch(`/api/listing/list?tab=${t}`);
    const data = await res.json();
    setProducts(data.products ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(tab); }, [tab, load]);

  async function runPrepare() {
    setPreparing(true);
    try {
      const res = await fetch("/api/listing/prepare", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        showToast(`✓ ${data.prepared}개 등록 자료 생성 완료`);
        await load(tab);
      } else {
        showToast(`✕ ${data.error ?? "준비 실패"}`);
      }
    } catch {
      showToast("✕ 네트워크 오류");
    } finally {
      setPreparing(false);
    }
  }

  async function handleAction(id: string, action: "approve" | "reject" | "listed") {
    setActing(id);
    try {
      const res = await fetch("/api/listing/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const data = await res.json();
      if (data.ok) {
        const msg = action === "approve" ? "승인 완료" : action === "reject" ? "거절 처리" : "등록 완료";
        showToast(`✓ ${msg}`);
        await load(tab);
      } else {
        showToast(`✕ ${data.error ?? "처리 실패"}`);
      }
    } catch {
      showToast("✕ 네트워크 오류");
    } finally {
      setActing(null);
    }
  }

  return (
    <div className="space-y-8">
      {/* 헤더 */}
      <header className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-indigo-50 to-violet-50 ring-1 ring-indigo-100 text-[11px] font-semibold text-indigo-700 uppercase tracking-wider">
              <ClipboardList size={11} strokeWidth={2.5} />
              Week 5
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">등록 워크플로우</h1>
          <p className="text-sm text-slate-500 mt-1.5">
            AI가 바이마 출품 자료를 생성합니다 — 사장님이 승인하면 등록 준비 완료
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => load(tab)}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-slate-600 bg-white ring-1 ring-slate-200 hover:bg-slate-50 transition-all disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            새로고침
          </button>
          <button
            onClick={runPrepare}
            disabled={preparing}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:opacity-90 transition-all shadow-md shadow-indigo-200 disabled:opacity-50"
          >
            {preparing ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
            AI 등록 자료 생성
          </button>
        </div>
      </header>

      {/* 탭 */}
      <div className="flex items-center gap-0 bg-white rounded-2xl ring-1 ring-slate-200/70 p-1.5 w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              tab === t.key
                ? `bg-slate-900 text-white shadow-sm`
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 콘텐츠 */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl ring-1 ring-slate-200/70 h-28 animate-pulse" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="bg-white rounded-2xl ring-1 ring-slate-200/70 py-20 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-50 text-slate-300 mb-4">
            <ClipboardList size={26} strokeWidth={1.5} />
          </div>
          <p className="text-base font-semibold text-slate-700">
            {tab === "ready"
              ? "승인 대기 상품이 없습니다"
              : tab === "approved"
              ? "등록 예정 상품이 없습니다"
              : tab === "listed"
              ? "등록 완료된 상품이 없습니다"
              : "거절된 상품이 없습니다"}
          </p>
          <p className="text-sm text-slate-400 mt-1">
            {tab === "ready"
              ? "'AI 등록 자료 생성' 버튼을 눌러 출품 준비를 시작하세요"
              : "다른 탭을 확인해 보세요"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {products.map((p) => (
            <ProductCard key={p.id} p={p} onAction={handleAction} acting={acting} />
          ))}
        </div>
      )}

      {/* 토스트 */}
      {toast && (
        <div className="fixed bottom-6 right-6 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-medium shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-300 z-50">
          {toast}
        </div>
      )}
    </div>
  );
}

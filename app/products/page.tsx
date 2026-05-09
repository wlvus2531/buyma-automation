"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Zap, ExternalLink, Star } from "lucide-react";

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

function ScoreBadge({ score }: { score: number | null }) {
  if (score == null) return <span className="text-gray-300 text-xs">—</span>;
  const color =
    score >= 90 ? "bg-green-100 text-green-700" :
    score >= 80 ? "bg-blue-100 text-blue-700" :
    "bg-yellow-100 text-yellow-700";
  return <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${color}`}>{score}</span>;
}

function StatusDot({ ok }: { ok: boolean }) {
  return <span className={`inline-block w-2 h-2 rounded-full ${ok ? "bg-green-400" : "bg-gray-300"}`} />;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<PipelineStep | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/products");
    const data = await res.json();
    setProducts(data.products ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function runPipeline(step: PipelineStep) {
    setRunning(step);
    setLastResult(null);
    try {
      const res = await fetch(`/api/${step === "sourcing" ? "sourcing/run" : step === "scraper" ? "scraper/run" : "translation/run"}`, { method: "POST" });
      const data = await res.json();
      if (step === "sourcing") setLastResult(`소싱 완료: ${data.saved}개 저장`);
      else if (step === "scraper") setLastResult(`URL/가격 수집: ${data.updated}개 업데이트`);
      else setLastResult(`번역 완료: ${data.translated}개`);
      await load();
    } catch {
      setLastResult("실행 실패");
    } finally {
      setRunning(null);
    }
  }

  const total = products.length;
  const withUrl = products.filter((p) => p.source_url).length;
  const withJp = products.filter((p) => p.name_jp).length;
  const withThumb = products.filter((p) => p.thumbnail_url).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI 소싱 상품</h1>
          <p className="text-sm text-gray-500 mt-1">총 {total}개 · URL {withUrl}개 · 번역 {withJp}개 · 썸네일 {withThumb}개</p>
        </div>
        <button onClick={load} disabled={loading} className="btn-secondary flex items-center gap-2">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> 새로고침
        </button>
      </div>

      {/* 파이프라인 실행 버튼 */}
      <div className="card p-4 flex flex-wrap gap-3 items-center">
        <span className="text-sm font-medium text-gray-600">파이프라인 수동 실행:</span>
        {(["sourcing", "scraper", "translation"] as PipelineStep[]).map((step) => {
          const labels: Record<PipelineStep, string> = {
            sourcing: "① AI 소싱 (30개 추출)",
            scraper: "② 가격/URL 수집",
            translation: "③ 일본어 번역",
          };
          return (
            <button
              key={step}
              onClick={() => runPipeline(step)}
              disabled={running !== null}
              className="btn-primary flex items-center gap-2 text-sm"
            >
              {running === step ? <RefreshCw size={13} className="animate-spin" /> : <Zap size={13} />}
              {labels[step]}
            </button>
          );
        })}
        {lastResult && (
          <span className="text-sm text-green-600 font-medium ml-2">✓ {lastResult}</span>
        )}
      </div>

      {/* 진행 현황 바 */}
      <div className="card p-4 grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="text-2xl font-bold text-indigo-600">{total}</p>
          <p className="text-xs text-gray-500 mt-1">소싱 완료</p>
          <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-400 rounded-full" style={{ width: "100%" }} />
          </div>
        </div>
        <div>
          <p className="text-2xl font-bold text-blue-600">{withUrl}</p>
          <p className="text-xs text-gray-500 mt-1">URL/가격 수집</p>
          <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-400 rounded-full" style={{ width: total ? `${(withUrl / total) * 100}%` : "0%" }} />
          </div>
        </div>
        <div>
          <p className="text-2xl font-bold text-green-600">{withJp}</p>
          <p className="text-xs text-gray-500 mt-1">일본어 번역</p>
          <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-green-400 rounded-full" style={{ width: total ? `${(withJp / total) * 100}%` : "0%" }} />
          </div>
        </div>
      </div>

      {/* 상품 테이블 */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {["썸네일", "상품명", "브랜드/구매처", "매입가", "판매가(JPY)", "마진", "AI점수", "URL", "번역"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 9 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-gray-100 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-gray-400">
                    상품이 없습니다. AI 소싱을 실행해 주세요.
                  </td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      {p.thumbnail_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.thumbnail_url} alt="" className="w-10 h-10 rounded-lg object-cover border border-gray-200" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                          <Star size={12} className="text-gray-300" />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 max-w-[180px]">
                      <p className="font-medium text-gray-900 truncate">{p.name_kr}</p>
                      {p.name_jp && <p className="text-xs text-gray-400 truncate">{p.name_jp}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-700">{p.brand ?? "—"}</p>
                      <p className="text-xs text-gray-400">{p.source_mall ?? "—"}</p>
                    </td>
                    <td className="px-4 py-3 font-medium whitespace-nowrap">
                      {p.cost_krw ? `₩${p.cost_krw.toLocaleString()}` : "—"}
                    </td>
                    <td className="px-4 py-3 font-medium whitespace-nowrap">
                      {p.list_price_jpy ? `¥${p.list_price_jpy.toLocaleString()}` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {p.margin_pct != null ? (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${p.margin_pct >= 20 ? "bg-green-100 text-green-700" : p.margin_pct >= 15 ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"}`}>
                          {p.margin_pct}%
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3"><ScoreBadge score={p.ai_score} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <StatusDot ok={!!p.source_url} />
                        {p.source_url && (
                          <a href={p.source_url} target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:text-indigo-700">
                            <ExternalLink size={13} />
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3"><StatusDot ok={!!p.name_jp} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

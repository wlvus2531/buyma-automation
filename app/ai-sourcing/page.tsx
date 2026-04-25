"use client";

import { useState } from "react";
import { Sparkles, RefreshCw, TrendingUp, Target, Lightbulb, Plus } from "lucide-react";
import type { AiSourcingItem } from "@/lib/types";
import { getSeason } from "@/lib/utils";
import clsx from "clsx";

const CATEGORIES = ["전체", "패션/의류", "패션잡화", "뷰티/화장품", "라이프스타일", "식품/건강", "문화상품/굿즈"];

const TREND_OPTIONS = [
  { id: "kwave", label: "한류 트렌드 (K-드라마·K팝)", checked: true },
  { id: "season", label: `시즌 트렌드 (${getSeason()})`, checked: true },
  { id: "derivative", label: "파생 상품 발굴", checked: true },
  { id: "lowcomp", label: "경쟁 낮은 틈새시장", checked: false },
  { id: "luxury", label: "프리미엄/명품 카테고리", checked: false },
];

export default function AiSourcingPage() {
  const [trends, setTrends] = useState(TREND_OPTIONS);
  const [category, setCategory] = useState("전체");
  const [budget, setBudget] = useState("");
  const [keywords, setKeywords] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<AiSourcingItem[]>([]);
  const [error, setError] = useState("");
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set());

  const selectedTrends = trends.filter((t) => t.checked).map((t) => t.label);

  async function handleGenerate() {
    if (selectedTrends.length === 0) {
      setError("하나 이상의 트렌드 방향을 선택해 주세요.");
      return;
    }
    setLoading(true);
    setError("");
    setResults([]);
    setAddedIds(new Set());

    try {
      const res = await fetch("/api/ai-sourcing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trends: selectedTrends, category, budget, keywords }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "AI 소싱 실패");
      setResults(data.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAddToSourcing(item: AiSourcingItem) {
    const res = await fetch("/api/sheets/sourcing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productName: `${item.productName} (${item.japaneseName})`,
        category: item.category,
        brand: item.brand,
        koreaPurchasePrice: 0,
        buymaLowestPrice: 0,
        sellingPrice: 0,
        competitorCount: 0,
        status: "조사중",
        shippingCost: 0,
        exchangeRate: 10,
        notes: `[AI추천] ${item.reason}`,
      }),
    });
    if (res.ok) setAddedIds((prev) => new Set(Array.from(prev).concat(item.rank)));
  }

  const competitionBadge = (level: AiSourcingItem["competitionLevel"]) => {
    const map = { 낮음: "bg-green-100 text-green-700", 보통: "bg-yellow-100 text-yellow-700", 높음: "bg-red-100 text-red-700" };
    return map[level];
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
          <Sparkles size={20} className="text-purple-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI 소싱 전략</h1>
          <p className="text-gray-500 text-sm">Claude AI가 한류·시즌·파생 트렌드를 분석해 상품 10개를 추천합니다</p>
        </div>
      </div>

      {/* 설정 패널 */}
      <div className="card space-y-5">
        <h2 className="font-semibold text-gray-900">소싱 방향 설정</h2>

        <div>
          <label className="label">트렌드 방향 (복수 선택)</label>
          <div className="space-y-2">
            {trends.map((t, i) => (
              <label key={t.id} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={t.checked}
                  onChange={(e) => {
                    const next = [...trends];
                    next[i] = { ...t, checked: e.target.checked };
                    setTrends(next);
                  }}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-700">{t.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="label">카테고리 필터</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="input"
            >
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="label">예산 범위 (KRW, 선택)</label>
            <input
              type="text"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="예: 5만~20만원"
              className="input"
            />
          </div>
          <div>
            <label className="label">키워드/참고 브랜드 (선택)</label>
            <input
              type="text"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="예: 마몽드, 젤라또피케"
              className="input"
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

        <button
          onClick={handleGenerate}
          disabled={loading}
          className="btn-primary flex items-center gap-2"
        >
          {loading ? <RefreshCw size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {loading ? "AI 분석 중..." : "상품 추천 받기 (10개)"}
        </button>
      </div>

      {/* 결과 */}
      {loading && (
        <div className="card text-center py-12">
          <RefreshCw size={32} className="animate-spin text-indigo-500 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">Claude AI가 트렌드를 분석하고 있습니다...</p>
          <p className="text-gray-400 text-sm mt-1">한류·시즌·파생 상품 기회를 리서치 중</p>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">AI 추천 소싱 리스트 ({results.length}개)</h2>
            <span className="text-xs text-gray-400">클릭 시 소싱 리스트에 자동 추가</span>
          </div>
          {results.map((item) => (
            <div key={item.rank} className="card hover:border-indigo-200 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-indigo-600">#{item.rank}</span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-900">{item.productName}</h3>
                      {item.japaneseName && (
                        <span className="text-sm text-gray-400">({item.japaneseName})</span>
                      )}
                      <span className={`badge ${competitionBadge(item.competitionLevel)}`}>
                        경쟁 {item.competitionLevel}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{item.category}</span>
                      {item.brand && <span className="text-xs text-gray-500">{item.brand}</span>}
                      <span className="text-xs font-medium text-green-600">예상 마진 {item.expectedMargin}</span>
                    </div>

                    <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="bg-blue-50 rounded-lg p-2.5">
                        <p className="text-xs text-blue-600 font-medium flex items-center gap-1 mb-1">
                          <TrendingUp size={12} /> 추천 이유
                        </p>
                        <p className="text-xs text-gray-700">{item.reason}</p>
                      </div>
                      <div className="bg-green-50 rounded-lg p-2.5">
                        <p className="text-xs text-green-600 font-medium flex items-center gap-1 mb-1">
                          <Target size={12} /> 가격대
                        </p>
                        <p className="text-xs text-gray-700">매입: {item.koreanPriceRange}</p>
                        <p className="text-xs text-gray-700">판매: {item.expectedSellingPrice}</p>
                      </div>
                      <div className="bg-yellow-50 rounded-lg p-2.5">
                        <p className="text-xs text-yellow-700 font-medium flex items-center gap-1 mb-1">
                          <Lightbulb size={12} /> 소싱 팁
                        </p>
                        <p className="text-xs text-gray-700">{item.sourcingTip}</p>
                      </div>
                    </div>

                    {item.trend && (
                      <p className="text-xs text-purple-600 mt-2">🔥 트렌드: {item.trend}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleAddToSourcing(item)}
                  disabled={addedIds.has(item.rank)}
                  className={clsx(
                    "flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                    addedIds.has(item.rank)
                      ? "bg-green-100 text-green-700 cursor-default"
                      : "bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
                  )}
                >
                  {addedIds.has(item.rank) ? "추가됨 ✓" : <><Plus size={12} /> 소싱 추가</>}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

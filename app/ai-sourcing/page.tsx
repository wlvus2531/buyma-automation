"use client";

import { useState, useEffect } from "react";
import {
  Sparkles, RefreshCw, TrendingUp, Target, Lightbulb,
  Plus, Sun, Moon, CheckCircle2, Clock,
} from "lucide-react";
import type { AiSourcingItem } from "@/lib/types";
import { getSeason } from "@/lib/utils";
import clsx from "clsx";

const CATEGORIES = ["전체", "패션/의류", "패션잡화", "뷰티/화장품", "라이프스타일", "식품/건강", "문화상품/굿즈"];

const MORNING_TRENDS = [
  { id: "kwave", label: "한류 트렌드 (K-드라마·K팝)", checked: true },
  { id: "season", label: `시즌 트렌드 (${getSeason()})`, checked: true },
  { id: "lowcomp", label: "경쟁 낮은 틈새시장", checked: true },
  { id: "luxury", label: "프리미엄/명품 카테고리", checked: false },
];

const EVENING_TRENDS = [
  { id: "derivative", label: "파생 상품 발굴", checked: true },
  { id: "crosssell", label: "교차 판매 기회", checked: true },
  { id: "restock", label: "재입고·교체 상품", checked: false },
  { id: "upsell", label: "업셀링 상품", checked: false },
];

type Mode = "morning" | "evening";

function confidenceBadge(c: number) {
  if (c >= 90) return "bg-green-100 text-green-700 border border-green-200";
  if (c >= 80) return "bg-blue-100 text-blue-700 border border-blue-200";
  if (c >= 70) return "bg-yellow-100 text-yellow-700 border border-yellow-200";
  return "bg-red-100 text-red-700 border border-red-200";
}

function ConfidenceBar({ value }: { value: number }) {
  const color = value >= 90 ? "bg-green-500" : value >= 80 ? "bg-blue-500" : value >= 70 ? "bg-yellow-500" : "bg-red-400";
  return (
    <div className="flex items-center gap-2 mt-1.5">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${confidenceBadge(value)}`}>{value}%</span>
    </div>
  );
}

export default function AiSourcingPage() {
  const [mode, setMode] = useState<Mode>("morning");
  const [morningTrends, setMorningTrends] = useState(MORNING_TRENDS);
  const [eveningTrends, setEveningTrends] = useState(EVENING_TRENDS);
  const [category, setCategory] = useState("전체");
  const [budget, setBudget] = useState("");
  const [keywords, setKeywords] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<AiSourcingItem[]>([]);
  const [error, setError] = useState("");
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set());
  const [autoQueue, setAutoQueue] = useState<AiSourcingItem[]>([]);

  const currentTrends = mode === "morning" ? morningTrends : eveningTrends;
  const setCurrentTrends = mode === "morning" ? setMorningTrends : setEveningTrends;
  const selectedTrends = currentTrends.filter((t) => t.checked).map((t) => t.label);

  useEffect(() => {
    setResults([]);
    setAddedIds(new Set());
    setError("");
  }, [mode]);

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
        body: JSON.stringify({ trends: selectedTrends, category, budget, keywords, mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "AI 소싱 실패");
      const items: AiSourcingItem[] = data.items ?? [];
      setResults(items);
      const highConf = items.filter((i) => (i.confidence ?? 0) >= 80);
      if (highConf.length > 0) setAutoQueue(highConf);
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
        notes: `[AI추천 ${item.confidence}%확신] ${item.reason}`,
      }),
    });
    if (res.ok) setAddedIds((prev) => new Set(Array.from(prev).concat(item.rank)));
  }

  async function handleAddAllQueue() {
    for (const item of autoQueue) {
      await handleAddToSourcing(item);
    }
    setAutoQueue([]);
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
          <p className="text-gray-500 text-sm">아침 5개(공격적 신규) · 저녁 5개(방어적 파생) — 확신도 80%+ 자동 승인 큐</p>
        </div>
      </div>

      {/* 모드 선택 */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setMode("morning")}
          className={clsx(
            "flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left",
            mode === "morning"
              ? "border-orange-400 bg-orange-50"
              : "border-gray-200 bg-white hover:border-orange-200"
          )}
        >
          <Sun size={22} className={mode === "morning" ? "text-orange-500" : "text-gray-400"} />
          <div>
            <div className={clsx("font-semibold text-sm", mode === "morning" ? "text-orange-700" : "text-gray-700")}>아침 소싱</div>
            <div className="text-xs text-gray-400">한류·트렌드 기반 신규 발굴</div>
          </div>
        </button>
        <button
          onClick={() => setMode("evening")}
          className={clsx(
            "flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left",
            mode === "evening"
              ? "border-indigo-400 bg-indigo-50"
              : "border-gray-200 bg-white hover:border-indigo-200"
          )}
        >
          <Moon size={22} className={mode === "evening" ? "text-indigo-500" : "text-gray-400"} />
          <div>
            <div className={clsx("font-semibold text-sm", mode === "evening" ? "text-indigo-700" : "text-gray-700")}>저녁 소싱</div>
            <div className="text-xs text-gray-400">현재 리스트 기반 파생·교체</div>
          </div>
        </button>
      </div>

      {/* 설정 패널 */}
      <div className="card space-y-5">
        <h2 className="font-semibold text-gray-900">
          {mode === "morning" ? "☀️ 아침 소싱 방향" : "🌙 저녁 소싱 방향"}
        </h2>

        <div>
          <label className="label">트렌드 방향 (복수 선택)</label>
          <div className="space-y-2">
            {currentTrends.map((t, i) => (
              <label key={t.id} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={t.checked}
                  onChange={(e) => {
                    const next = [...currentTrends];
                    next[i] = { ...t, checked: e.target.checked };
                    setCurrentTrends(next);
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
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="input">
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="label">예산 범위 (KRW, 선택)</label>
            <input type="text" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="예: 5만~20만원" className="input" />
          </div>
          <div>
            <label className="label">키워드/참고 브랜드 (선택)</label>
            <input type="text" value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="예: 마몽드, 젤라또피케" className="input" />
          </div>
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

        <button
          onClick={handleGenerate}
          disabled={loading}
          className={clsx(
            "btn-primary flex items-center gap-2",
            mode === "morning" ? "bg-orange-500 hover:bg-orange-600" : "bg-indigo-600 hover:bg-indigo-700"
          )}
        >
          {loading ? <RefreshCw size={16} className="animate-spin" /> : mode === "morning" ? <Sun size={16} /> : <Moon size={16} />}
          {loading ? "AI 분석 중..." : `${mode === "morning" ? "아침" : "저녁"} 소싱 5개 추천받기`}
        </button>
      </div>

      {loading && (
        <div className="card text-center py-12">
          <RefreshCw size={32} className="animate-spin text-indigo-500 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">Claude AI가 {mode === "morning" ? "트렌드·한류" : "파생·교체"} 기회를 분석하고 있습니다...</p>
          <p className="text-gray-400 text-sm mt-1">5개 정밀 추천 + 확신도 계산 중</p>
        </div>
      )}

      {/* 자동 승인 큐 */}
      {autoQueue.length > 0 && (
        <div className="card border-l-4 border-l-green-400 bg-green-50">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-green-800 flex items-center gap-2">
              <CheckCircle2 size={16} className="text-green-600" />
              자동 승인 대기열
              <span className="bg-green-200 text-green-800 text-xs font-bold px-2 py-0.5 rounded-full">{autoQueue.length}개</span>
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-xs text-green-600">확신도 80%+ 상품</span>
              <button
                onClick={handleAddAllQueue}
                className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center gap-1"
              >
                <Plus size={12} /> 전체 소싱 추가
              </button>
            </div>
          </div>
          <div className="space-y-2">
            {autoQueue.map((item) => (
              <div key={item.rank} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-green-200">
                <div>
                  <span className="font-medium text-gray-900 text-sm">{item.productName}</span>
                  <span className="text-gray-400 text-xs ml-2">({item.japaneseName})</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${confidenceBadge(item.confidence ?? 0)}`}>
                    {item.confidence}%
                  </span>
                  <button
                    onClick={() => handleAddToSourcing(item)}
                    disabled={addedIds.has(item.rank)}
                    className={clsx(
                      "text-xs px-2 py-1 rounded-lg font-medium transition-colors",
                      addedIds.has(item.rank) ? "bg-green-100 text-green-700" : "bg-green-600 text-white hover:bg-green-700"
                    )}
                  >
                    {addedIds.has(item.rank) ? "추가됨 ✓" : "추가"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 전체 추천 결과 */}
      {results.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">
              {mode === "morning" ? "☀️" : "🌙"} AI 추천 소싱 리스트 ({results.length}개)
            </h2>
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> 90%+</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> 80~89%</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500 inline-block" /> 70~79%</span>
            </div>
          </div>
          {results.map((item) => (
            <div key={item.rank} className={clsx(
              "card hover:border-indigo-200 transition-colors",
              (item.confidence ?? 0) >= 80 && "border-l-4 border-l-blue-400"
            )}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-indigo-600">#{item.rank}</span>
                  </div>
                  <div className="min-w-0 flex-1">
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

                    <ConfidenceBar value={item.confidence ?? 0} />

                    <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="bg-blue-50 rounded-lg p-2.5">
                        <p className="text-xs text-blue-600 font-medium flex items-center gap-1 mb-1">
                          <TrendingUp size={12} /> 추천 이유
                        </p>
                        <p className="text-xs text-gray-700 leading-relaxed">{item.reason}</p>
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

                    {(item.confidence ?? 0) >= 80 && (
                      <div className="mt-2 flex items-center gap-1 text-xs text-blue-600">
                        <Clock size={11} />
                        <span>확신도 80%+ — 자동 승인 대기열에 포함됨</span>
                      </div>
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

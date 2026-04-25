"use client";

import { useState, useEffect, useMemo } from "react";
import {
  TrendingUp, TrendingDown, BarChart2, AlertTriangle,
  CheckCircle2, Zap, Heart, MessageCircle, Search,
  AlertCircle, Star, RefreshCw,
} from "lucide-react";
import type { Order, SourcingItem } from "@/lib/types";
import clsx from "clsx";

// ─── K-아이돌 브랜드 데이터 ────────────────────────────────────────────────────

const K_IDOL_BRANDS = [
  { brand: "Thug Club", category: "스트릿웨어", desc: "방탄·스트레이키즈 착용, 후디·그래픽티", tag: "방탄/SKZ", margin: "35~50%", color: "bg-purple-50 border-purple-200" },
  { brand: "SCULPTOR", category: "패션/액세서리", desc: "아이브·(여자)아이들 착용, Y2K 주얼리", tag: "아이브", margin: "40~55%", color: "bg-pink-50 border-pink-200" },
  { brand: "Matin Kim", category: "캐주얼/아우터", desc: "블랙핑크·뉴진스 착용, 데님·재킷", tag: "블핑/NJ", margin: "30~45%", color: "bg-indigo-50 border-indigo-200" },
  { brand: "LUV IS TRUE", category: "스트릿패션", desc: "세븐틴·TXT 착용, 로고 후디·캡", tag: "SVT/TXT", margin: "35~50%", color: "bg-blue-50 border-blue-200" },
  { brand: "THEAIRTOWN", category: "캐주얼/룩북", desc: "르세라핌·IVE 착용, 미니멀 코디", tag: "르세라핌", margin: "30~45%", color: "bg-emerald-50 border-emerald-200" },
  { brand: "ADLV", category: "캐주얼", desc: "전 아이돌 착용, 베이비페이스 라벨 시그니처", tag: "전체", margin: "25~40%", color: "bg-orange-50 border-orange-200" },
  { brand: "COVERNAT", category: "아웃도어/캐주얼", desc: "방탄 RM 착용, 빈티지 캡·자켓", tag: "RM", margin: "25~38%", color: "bg-gray-50 border-gray-200" },
];

// ─── 타입 ────────────────────────────────────────────────────────────────────

interface MonthlyData { month: string; revenue: number; margin: number; orderCount: number; }
interface ProductSales { productName: string; orderCount: number; totalRevenue: number; avgMarginRate: number; lastOrderDate: string | null; }
interface AiRec { type: "replace" | "price" | "margin" | "competition"; priority: "high" | "medium" | "low"; item: SourcingItem; message: string; action: string; }

// ─── 헬퍼 함수 ────────────────────────────────────────────────────────────────

function getLast6MonthKeys(): string[] {
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
}

function computeMonthly(orders: Order[]): MonthlyData[] {
  const keys = getLast6MonthKeys();
  const map: Record<string, { rev: number; margins: number[]; cnt: number }> = {};
  keys.forEach(k => (map[k] = { rev: 0, margins: [], cnt: 0 }));
  for (const o of orders) {
    if (!o.orderDate) continue;
    const d = new Date(o.orderDate);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!map[key]) continue;
    map[key].rev += o.sellingPrice || 0;
    map[key].margins.push(o.marginRate || 0);
    map[key].cnt++;
  }
  return keys.map(k => {
    const v = map[k];
    const mn = k.split("-")[1];
    return { month: `${mn}월`, revenue: v.rev, margin: v.margins.length ? v.margins.reduce((a, b) => a + b, 0) / v.margins.length : 0, orderCount: v.cnt };
  });
}

function computeProductStats(orders: Order[]): ProductSales[] {
  const map: Record<string, ProductSales> = {};
  for (const o of orders) {
    if (!map[o.productName]) map[o.productName] = { productName: o.productName, orderCount: 0, totalRevenue: 0, avgMarginRate: 0, lastOrderDate: null };
    const p = map[o.productName];
    p.orderCount++;
    p.totalRevenue += o.sellingPrice || 0;
    p.avgMarginRate = (p.avgMarginRate * (p.orderCount - 1) + (o.marginRate || 0)) / p.orderCount;
    if (!p.lastOrderDate || o.orderDate > p.lastOrderDate) p.lastOrderDate = o.orderDate;
  }
  return Object.values(map).sort((a, b) => b.totalRevenue - a.totalRevenue);
}

function daysSince(d: string | null): number {
  if (!d) return 999;
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
}

function computeAiRecs(sourcing: SourcingItem[], orders: Order[]): AiRec[] {
  const lastOrderMap: Record<string, string> = {};
  for (const o of orders) {
    if (!lastOrderMap[o.productName] || o.orderDate > lastOrderMap[o.productName]) lastOrderMap[o.productName] = o.orderDate;
  }
  const recs: AiRec[] = [];
  for (const item of sourcing) {
    if (item.status !== "판매중") continue;
    const days = daysSince(lastOrderMap[item.productName] ?? null);
    if (days >= 21) recs.push({ type: "replace", priority: days >= 42 ? "high" : "medium", item, message: days === 999 ? "판매 이력 없음" : `${days}일 동안 판매 없음`, action: "교체 검토 또는 가격 인하 필요" });
    if (item.buymaLowestPrice > 0 && item.sellingPrice > item.buymaLowestPrice) {
      const diffPct = ((item.sellingPrice - item.buymaLowestPrice) / item.buymaLowestPrice * 100).toFixed(1);
      recs.push({ type: "price", priority: parseFloat(diffPct) > 15 ? "high" : "medium", item, message: `내 판매가 ¥${item.sellingPrice.toLocaleString()} > 최저가 ¥${item.buymaLowestPrice.toLocaleString()} (+${diffPct}%)`, action: "가격을 바이마 최저가 이하로 낮추거나 차별화 요소 추가 필요" });
    }
    if (item.marginWithRefund < 10 && item.marginWithRefund > 0) recs.push({ type: "margin", priority: item.marginWithRefund < 5 ? "high" : "low", item, message: `마진율 ${item.marginWithRefund.toFixed(1)}% (환급 포함)`, action: "매입가 협상 또는 판매가 인상 필요" });
    if (item.competitorCount >= 5 && days >= 14) recs.push({ type: "competition", priority: "medium", item, message: `경쟁자 ${item.competitorCount}명 / ${days >= 999 ? "판매이력없음" : `${days}일 미판매`}`, action: "경쟁 회피 또는 틈새 포지셔닝 필요" });
  }
  return recs.sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.priority] - { high: 0, medium: 1, low: 2 }[b.priority]));
}

// ─── SVG 차트 ────────────────────────────────────────────────────────────────

function EmptyChart({ label }: { label: string }) {
  return <div className="flex items-center justify-center h-28 text-gray-400 text-sm bg-gray-50 rounded-lg border border-dashed border-gray-200">{label}</div>;
}

function RevenueBarChart({ data }: { data: MonthlyData[] }) {
  if (!data.some(d => d.revenue > 0)) return <EmptyChart label="주문 데이터가 없습니다" />;
  const W = 500, H = 200, PL = 8, PB = 32, PT = 20, PR = 8;
  const cW = W - PL - PR, cH = H - PT - PB;
  const maxRev = Math.max(...data.map(d => d.revenue));
  const bw = Math.floor(cW / data.length * 0.55);
  const step = cW / data.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      <line x1={PL} y1={PT + cH} x2={W - PR} y2={PT + cH} stroke="#e5e7eb" strokeWidth="1" />
      {data.map((d, i) => {
        const bh = Math.max(3, (d.revenue / maxRev) * cH);
        const x = PL + step * i + (step - bw) / 2;
        const y = PT + cH - bh;
        return (
          <g key={i}>
            <rect x={x} y={y} width={bw} height={bh} fill={d.orderCount > 0 ? "#6366f1" : "#e5e7eb"} rx="3" />
            {bh > 22 && <text x={x + bw / 2} y={y + 13} textAnchor="middle" fontSize="8" fill="white" fontWeight="600">¥{(d.revenue / 1000).toFixed(0)}k</text>}
            <text x={x + bw / 2} y={H - 18} textAnchor="middle" fontSize="9" fill="#6b7280">{d.month}</text>
            <text x={x + bw / 2} y={H - 6} textAnchor="middle" fontSize="8" fill="#9ca3af">{d.orderCount}건</text>
          </g>
        );
      })}
    </svg>
  );
}

function MarginLineChart({ data }: { data: MonthlyData[] }) {
  if (data.filter(d => d.orderCount > 0).length < 2) return <EmptyChart label="2개월 이상 주문 데이터 필요" />;
  const W = 500, H = 170, PL = 36, PB = 28, PT = 16, PR = 12;
  const cW = W - PL - PR, cH = H - PT - PB;
  const rates = data.map(d => d.margin);
  const maxR = Math.max(...rates, 30);
  const minR = Math.min(...rates.filter((_, i) => data[i].orderCount > 0), 0);
  const range = maxR - minR || 1;
  const pts = data.map((d, i) => ({ x: PL + (i / (data.length - 1)) * cW, y: PT + cH - ((d.margin - minR) / range) * cH, d }));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {[0, 50, 100].map(pct => {
        const y = PT + (1 - pct / 100) * cH;
        return (
          <g key={pct}>
            <line x1={PL} y1={y} x2={W - PR} y2={y} stroke="#f3f4f6" strokeWidth="1" />
            <text x={PL - 4} y={y + 4} textAnchor="end" fontSize="8" fill="#9ca3af">{(minR + range * pct / 100).toFixed(0)}%</text>
          </g>
        );
      })}
      <polyline points={pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")} fill="none" stroke="#6366f1" strokeWidth="2" />
      {pts.map(({ x, y, d }, i) => (
        <g key={i}>
          {d.orderCount > 0 && <circle cx={x} cy={y} r="3" fill="#6366f1" />}
          {d.orderCount > 0 && <text x={x} y={y - 7} textAnchor="middle" fontSize="8" fill="#374151">{d.margin.toFixed(1)}%</text>}
          <text x={x} y={H - 4} textAnchor="middle" fontSize="9" fill="#6b7280">{d.month}</text>
        </g>
      ))}
    </svg>
  );
}

// ─── 판매 추이 탭 ─────────────────────────────────────────────────────────────

function TrendTab({ monthly, products, orders }: { monthly: MonthlyData[]; products: ProductSales[]; orders: Order[] }) {
  const totalRevenue = orders.reduce((s, o) => s + (o.sellingPrice || 0), 0);
  const avgMargin = orders.length ? orders.reduce((s, o) => s + (o.marginRate || 0), 0) / orders.length : 0;
  const cur = monthly[monthly.length - 1];
  const prev = monthly[monthly.length - 2];
  const revChange = prev?.revenue > 0 ? ((cur.revenue - prev.revenue) / prev.revenue * 100) : null;
  const top5 = products.slice(0, 5);
  const maxRevTop = top5[0]?.totalRevenue || 1;
  const noSale = products.filter(p => daysSince(p.lastOrderDate) >= 21).slice(0, 5);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "전체 누적 매출", value: `¥${totalRevenue.toLocaleString()}`, sub: `총 ${orders.length}건`, icon: BarChart2, color: "text-indigo-600" },
          { label: "이번 달 매출", value: `¥${cur?.revenue.toLocaleString() || 0}`, sub: `${cur?.orderCount || 0}건`, icon: TrendingUp, color: "text-blue-600" },
          { label: "평균 마진율", value: `${avgMargin.toFixed(1)}%`, sub: "전체 주문 평균", icon: Star, color: "text-green-600" },
          { label: "전월 대비", value: revChange !== null ? `${revChange > 0 ? "+" : ""}${revChange.toFixed(1)}%` : "-", sub: revChange !== null ? (revChange >= 0 ? "성장" : "하락") : "데이터 없음", icon: revChange !== null && revChange >= 0 ? TrendingUp : TrendingDown, color: revChange === null ? "text-gray-400" : revChange >= 0 ? "text-green-600" : "text-red-500" },
        ].map(({ label, value, sub, icon: Icon, color }) => (
          <div key={label} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2"><Icon size={15} className={color} /><span className="text-xs text-gray-500">{label}</span></div>
            <div className={clsx("text-xl font-bold", color)}>{value}</div>
            <div className="text-xs text-gray-400 mt-0.5">{sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2"><BarChart2 size={15} className="text-indigo-500" /> 월별 매출 (JPY)</h3>
          <RevenueBarChart data={monthly} />
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2"><TrendingUp size={15} className="text-green-500" /> 월별 평균 마진율 (%)</h3>
          <MarginLineChart data={monthly} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2"><TrendingUp size={15} className="text-green-500" /> 잘 팔리는 상품 Top 5</h3>
          {top5.length === 0 ? <p className="text-sm text-gray-400">판매 데이터가 없습니다</p> : (
            <div className="space-y-2.5">
              {top5.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-400 w-4">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800 truncate mb-0.5">{p.productName}</div>
                    <div className="h-1.5 bg-gray-100 rounded-full">
                      <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${(p.totalRevenue / maxRevTop) * 100}%` }} />
                    </div>
                  </div>
                  <div className="text-xs text-right shrink-0">
                    <div className="font-semibold text-gray-700">¥{p.totalRevenue.toLocaleString()}</div>
                    <div className="text-gray-400">{p.orderCount}건</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2"><TrendingDown size={15} className="text-red-400" /> 판매 부진 상품 (21일+)</h3>
          {noSale.length === 0 ? (
            <p className="text-sm text-green-600 flex items-center gap-1"><CheckCircle2 size={14} /> 모든 상품이 최근 3주 내 판매됨</p>
          ) : (
            <div className="space-y-2">
              {noSale.map((p, i) => {
                const d = daysSince(p.lastOrderDate);
                return (
                  <div key={i} className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium text-gray-800 truncate flex-1">{p.productName}</div>
                    <span className={clsx("text-xs px-1.5 py-0.5 rounded font-medium shrink-0", d >= 42 ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700")}>
                      {p.lastOrderDate ? `${d}일 전` : "이력없음"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── AI 추천 탭 ───────────────────────────────────────────────────────────────

const PRIORITY_MAP = { high: { label: "긴급", cls: "bg-red-100 text-red-700 border-red-200" }, medium: { label: "주의", cls: "bg-yellow-100 text-yellow-700 border-yellow-200" }, low: { label: "검토", cls: "bg-blue-100 text-blue-700 border-blue-200" } };
const TYPE_MAP = { replace: { label: "교체", color: "text-red-500" }, price: { label: "가격조정", color: "text-orange-500" }, margin: { label: "마진개선", color: "text-yellow-600" }, competition: { label: "경쟁회피", color: "text-blue-500" } };

function AiTab({ recs, sourcing }: { recs: AiRec[]; sourcing: SourcingItem[] }) {
  const activeCount = sourcing.filter(s => s.status === "판매중").length;
  return (
    <div className="space-y-5">
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2"><Zap size={15} className="text-yellow-500" /> AI 상품 교체·개선 추천</h3>
          <span className="text-xs text-gray-400">판매중 상품 {activeCount}개 분석</span>
        </div>
        {recs.length === 0 ? (
          <div className="flex items-center gap-2 text-green-600 text-sm py-3"><CheckCircle2 size={15} /> 현재 주의가 필요한 상품이 없습니다</div>
        ) : (
          <div className="space-y-3">
            {recs.map((r, i) => {
              const pInfo = PRIORITY_MAP[r.priority];
              const tInfo = TYPE_MAP[r.type];
              return (
                <div key={i} className={clsx("border rounded-lg p-3", r.priority === "high" ? "border-red-200 bg-red-50" : r.priority === "medium" ? "border-yellow-200 bg-yellow-50" : "border-blue-200 bg-blue-50")}>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={clsx("text-xs px-1.5 py-0.5 rounded border font-medium", pInfo.cls)}>{pInfo.label}</span>
                    <span className={clsx("text-xs font-semibold", tInfo.color)}>[{tInfo.label}]</span>
                    <span className="font-medium text-gray-800 text-sm">{r.item.productName}</span>
                    {r.item.brand && <span className="text-xs text-gray-500 bg-white bg-opacity-60 px-1.5 py-0.5 rounded">{r.item.brand}</span>}
                  </div>
                  <p className="text-xs text-gray-600 mb-1">{r.message}</p>
                  <p className="text-xs text-indigo-700 font-medium flex items-center gap-1"><AlertCircle size={11} /> {r.action}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <h3 className="font-semibold text-gray-800 mb-1 flex items-center gap-2"><Star size={15} className="text-yellow-500" /> K-아이돌 착용 브랜드 소싱 기회 (2026)</h3>
        <p className="text-xs text-gray-400 mb-4">일본 바이마 구매자들이 높은 관심을 보이는 K-아이돌 착용 한국 브랜드</p>
        <div className="grid grid-cols-2 gap-3">
          {K_IDOL_BRANDS.map((b, i) => (
            <div key={i} className={clsx("border rounded-lg p-3", b.color)}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-sm text-gray-900">{b.brand}</span>
                <span className="text-xs px-1.5 py-0.5 bg-white bg-opacity-70 rounded text-gray-600">{b.tag}</span>
              </div>
              <p className="text-xs text-gray-500 mb-0.5">{b.category}</p>
              <p className="text-xs text-gray-600 mb-1.5">{b.desc}</p>
              <span className="text-xs font-medium text-indigo-700">예상 마진율: {b.margin}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── 수요 예측 탭 ─────────────────────────────────────────────────────────────

function DemandTab({ sourcing, wishlistData, onSave }: {
  sourcing: SourcingItem[];
  wishlistData: Record<string, { wishlistCount: number; inquiryCount: number }>;
  onSave: (d: Record<string, { wishlistCount: number; inquiryCount: number }>) => void;
}) {
  const [local, setLocal] = useState(wishlistData);
  useEffect(() => setLocal(wishlistData), [wishlistData]);

  function update(id: string, field: "wishlistCount" | "inquiryCount", value: number) {
    const next = { ...local, [id]: { ...(local[id] ?? { wishlistCount: 0, inquiryCount: 0 }), [field]: value } };
    setLocal(next);
    onSave(next);
  }

  function demandIndex(id: string) { const e = local[id]; return e ? e.wishlistCount * 2 + e.inquiryCount * 3 : 0; }
  function demandLevel(idx: number) {
    if (idx >= 30) return { label: "매우높음", textCls: "text-red-600", barCls: "bg-red-500" };
    if (idx >= 15) return { label: "높음", textCls: "text-orange-500", barCls: "bg-orange-400" };
    if (idx >= 5) return { label: "보통", textCls: "text-yellow-600", barCls: "bg-yellow-400" };
    return { label: "낮음", textCls: "text-gray-400", barCls: "bg-gray-200" };
  }

  const active = sourcing.filter(s => s.status === "판매중" || s.status === "등록완료");
  const sorted = [...active].sort((a, b) => demandIndex(b.id) - demandIndex(a.id));
  const maxIdx = Math.max(...sorted.map(s => demandIndex(s.id)), 1);

  return (
    <div className="space-y-4">
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 text-sm">
        <div className="flex items-center gap-2 mb-1 font-semibold text-indigo-800"><Heart size={14} className="text-pink-500" /> 수요 예측 지표 입력</div>
        <p className="text-xs text-indigo-600">바이마 출품 화면에서 확인한 찜하기·문의 수를 입력하세요. <strong>수요 지수 = 찜하기 × 2 + 문의 × 3</strong></p>
      </div>
      {active.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-200 rounded-xl p-8 text-center text-gray-400 text-sm">판매중·등록완료 상태인 소싱 상품이 없습니다</div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left p-3 font-medium text-gray-600">상품명 / 브랜드</th>
                <th className="text-center p-3 font-medium text-gray-600 w-28"><span className="flex items-center justify-center gap-1"><Heart size={12} /> 찜하기</span></th>
                <th className="text-center p-3 font-medium text-gray-600 w-28"><span className="flex items-center justify-center gap-1"><MessageCircle size={12} /> 문의</span></th>
                <th className="p-3 font-medium text-gray-600">수요 지수</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sorted.map(s => {
                const idx = demandIndex(s.id);
                const level = demandLevel(idx);
                const e = local[s.id] ?? { wishlistCount: 0, inquiryCount: 0 };
                return (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="p-3">
                      <div className="font-medium text-gray-800">{s.productName}</div>
                      <div className="text-xs text-gray-400">{s.brand}</div>
                    </td>
                    <td className="p-3 text-center">
                      <input type="number" min="0" value={e.wishlistCount}
                        onChange={ev => update(s.id, "wishlistCount", parseInt(ev.target.value) || 0)}
                        className="w-16 border border-gray-300 rounded px-2 py-1 text-center text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                    </td>
                    <td className="p-3 text-center">
                      <input type="number" min="0" value={e.inquiryCount}
                        onChange={ev => update(s.id, "inquiryCount", parseInt(ev.target.value) || 0)}
                        className="w-16 border border-gray-300 rounded px-2 py-1 text-center text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 bg-gray-100 rounded-full">
                          <div className={clsx("h-full rounded-full transition-all duration-300", level.barCls)} style={{ width: `${Math.min(100, (idx / maxIdx) * 100)}%` }} />
                        </div>
                        <span className="text-sm font-bold text-gray-700 w-6">{idx}</span>
                        <span className={clsx("text-xs font-medium w-16", level.textCls)}>{level.label}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── 경쟁 모니터링 탭 ─────────────────────────────────────────────────────────

function CompetitionTab({ sourcing }: { sourcing: SourcingItem[] }) {
  const withPrice = sourcing.filter(s => s.buymaLowestPrice > 0 && s.status !== "중단");
  const needAdjust = withPrice.filter(s => s.sellingPrice > s.buymaLowestPrice);
  const ok = withPrice.filter(s => s.sellingPrice <= s.buymaLowestPrice);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "가격 조정 필요", count: needAdjust.length, color: "text-red-600" },
          { label: "경쟁력 있는 가격", count: ok.length, color: "text-green-600" },
          { label: "최저가 미입력", count: sourcing.length - withPrice.length, color: "text-gray-400" },
        ].map(({ label, count, color }) => (
          <div key={label} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className={clsx("text-2xl font-bold", color)}>{count}</div>
            <div className="text-sm text-gray-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {needAdjust.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2"><AlertTriangle size={15} className="text-red-500" /> 가격 조정 필요 상품</h3>
          <div className="space-y-2">
            {needAdjust.map(s => {
              const diff = s.sellingPrice - s.buymaLowestPrice;
              const diffPct = (diff / s.buymaLowestPrice * 100).toFixed(1);
              return (
                <div key={s.id} className={clsx("flex items-center justify-between gap-3 p-3 rounded-lg border", parseFloat(diffPct) > 15 ? "bg-red-50 border-red-200" : "bg-yellow-50 border-yellow-200")}>
                  <div>
                    <div className="font-medium text-gray-800 text-sm">{s.productName}</div>
                    <div className="text-xs text-gray-500">{s.brand} · {s.category}</div>
                  </div>
                  <div className="text-right text-sm shrink-0">
                    <div className="text-gray-700">내 가격: ¥{s.sellingPrice.toLocaleString()}</div>
                    <div className="text-gray-500">최저가: ¥{s.buymaLowestPrice.toLocaleString()}</div>
                    <div className={clsx("font-bold", parseFloat(diffPct) > 15 ? "text-red-600" : "text-yellow-600")}>+¥{diff.toLocaleString()} (+{diffPct}%)</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {withPrice.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2"><Search size={15} className="text-blue-500" /> 전체 가격 비교</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left p-3 font-medium text-gray-600">상품명</th>
                <th className="text-right p-3 font-medium text-gray-600">내 판매가</th>
                <th className="text-right p-3 font-medium text-gray-600">바이마 최저가</th>
                <th className="text-right p-3 font-medium text-gray-600">차이</th>
                <th className="text-center p-3 font-medium text-gray-600">상태</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {withPrice.map(s => {
                const diff = s.sellingPrice - s.buymaLowestPrice;
                const diffPct = s.buymaLowestPrice > 0 ? (diff / s.buymaLowestPrice * 100).toFixed(1) : "0";
                const status = diff > 0 ? { label: "조정필요", cls: "bg-red-100 text-red-700" } : diff < -500 ? { label: "매우경쟁", cls: "bg-green-100 text-green-700" } : { label: "적정가", cls: "bg-gray-100 text-gray-600" };
                return (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="p-3"><div className="font-medium text-gray-800">{s.productName}</div><div className="text-xs text-gray-400">{s.brand}</div></td>
                    <td className="p-3 text-right font-medium">¥{s.sellingPrice.toLocaleString()}</td>
                    <td className="p-3 text-right text-gray-500">¥{s.buymaLowestPrice.toLocaleString()}</td>
                    <td className={clsx("p-3 text-right font-semibold", diff > 0 ? "text-red-500" : "text-green-600")}>{diff > 0 ? "+" : ""}{diff.toLocaleString()} ({diff > 0 ? "+" : ""}{diffPct}%)</td>
                    <td className="p-3 text-center"><span className={clsx("text-xs px-2 py-0.5 rounded-full", status.cls)}>{status.label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── 메인 페이지 ──────────────────────────────────────────────────────────────

type Tab = "trend" | "ai" | "demand" | "competition";

export default function AnalyticsPage() {
  const [tab, setTab] = useState<Tab>("trend");
  const [orders, setOrders] = useState<Order[]>([]);
  const [sourcing, setSourcing] = useState<SourcingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [wishlistData, setWishlistData] = useState<Record<string, { wishlistCount: number; inquiryCount: number }>>({});

  useEffect(() => {
    Promise.all([
      fetch("/api/sheets/orders").then(r => r.json()),
      fetch("/api/sheets/sourcing").then(r => r.json()),
    ]).then(([ord, src]) => {
      setOrders(ord.orders ?? []);
      setSourcing(src.items ?? []);
    }).finally(() => setLoading(false));
    const saved = localStorage.getItem("buyma-wishlist");
    if (saved) setWishlistData(JSON.parse(saved));
  }, []);

  const monthly = useMemo(() => computeMonthly(orders), [orders]);
  const products = useMemo(() => computeProductStats(orders), [orders]);
  const aiRecs = useMemo(() => computeAiRecs(sourcing, orders), [sourcing, orders]);

  if (loading) {
    return <div className="p-8 flex items-center justify-center text-gray-400"><RefreshCw size={16} className="animate-spin mr-2" /> 데이터 불러오는 중...</div>;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">판매 추이 분석</h1>
        <p className="text-sm text-gray-500 mt-1">매출·마진 추이 · AI 교체·개선 추천 · 수요 예측 · 경쟁 모니터링</p>
      </div>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg mb-6 w-fit">
        {([["trend", "📈 판매 추이"], ["ai", "🤖 AI 추천"], ["demand", "💫 수요 예측"], ["competition", "🔍 경쟁 모니터링"]] as [Tab, string][]).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} className={clsx("px-4 py-2 rounded-md text-sm font-medium transition-all", tab === t ? "bg-white shadow-sm text-indigo-700" : "text-gray-600 hover:text-gray-900")}>{label}</button>
        ))}
      </div>

      {tab === "trend" && <TrendTab monthly={monthly} products={products} orders={orders} />}
      {tab === "ai" && <AiTab recs={aiRecs} sourcing={sourcing} />}
      {tab === "demand" && (
        <DemandTab sourcing={sourcing} wishlistData={wishlistData} onSave={data => { setWishlistData(data); localStorage.setItem("buyma-wishlist", JSON.stringify(data)); }} />
      )}
      {tab === "competition" && <CompetitionTab sourcing={sourcing} />}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  TrendingUp, ShoppingCart, Package, BarChart3, ArrowRight, Sparkles,
  AlertCircle, Truck, TrendingDown, Zap, Target, RefreshCw,
} from "lucide-react";
import type { SourcingItem, Order } from "@/lib/types";
import { formatKrw, formatJpy, statusBadgeClass } from "@/lib/utils";
import clsx from "clsx";

type DashTab = "strategic" | "operational" | "analytical";

// ─── 환율 바 ──────────────────────────────────────────────────────────────────

function ExchangeRateBar() {
  const [rate, setRate] = useState<number | null>(null);
  const [lastUpdated, setLastUpdated] = useState("");
  const [prevRate, setPrevRate] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("jpy_prev_rate");
    if (stored) setPrevRate(parseFloat(stored));

    fetch("/api/exchange-rate")
      .then((r) => r.json())
      .then((d) => {
        if (d.krwPerJpy) {
          setRate(d.krwPerJpy);
          setLastUpdated(d.lastUpdated ? new Date(d.lastUpdated).toLocaleDateString("ko-KR") : "");
          const prev = localStorage.getItem("jpy_prev_rate");
          if (!prev) {
            localStorage.setItem("jpy_prev_rate", String(d.krwPerJpy));
          } else if (prev !== String(d.krwPerJpy)) {
            setPrevRate(parseFloat(prev));
            localStorage.setItem("jpy_prev_rate", String(d.krwPerJpy));
          }
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const change = rate && prevRate ? ((rate - prevRate) / prevRate) * 100 : 0;
  const bigChange = Math.abs(change) >= 1;

  if (loading) return (
    <div className="h-9 bg-gray-100 rounded-xl animate-pulse" />
  );

  if (!rate) return null;

  return (
    <div className={clsx(
      "flex items-center gap-3 px-4 py-2 rounded-xl text-sm",
      bigChange ? "bg-orange-50 border border-orange-200" : "bg-blue-50 border border-blue-100"
    )}>
      {bigChange && <AlertCircle size={14} className="text-orange-500 shrink-0" />}
      <span className={clsx("font-medium", bigChange ? "text-orange-700" : "text-blue-700")}>
        엔화 환율 ¥1 = ₩{rate.toFixed(2)}
      </span>
      {prevRate && change !== 0 && (
        <span className={clsx("text-xs font-medium flex items-center gap-0.5", change > 0 ? "text-red-500" : "text-green-600")}>
          {change > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
          {Math.abs(change).toFixed(2)}%
          {bigChange && " ⚠️ 1% 이상 변동"}
        </span>
      )}
      {lastUpdated && <span className="text-xs text-gray-400 ml-auto">업데이트: {lastUpdated}</span>}
    </div>
  );
}

// ─── 전략적 뷰 ────────────────────────────────────────────────────────────────

function StrategicView({ sourcing, orders, loading }: { sourcing: SourcingItem[]; orders: Order[]; loading: boolean }) {
  const activeItems = sourcing.filter((s) => s.status === "판매중").length;
  const pendingOrders = orders.filter((o) => o.status === "주문접수" || o.status === "발주완료").length;
  const shippingOrders = orders.filter((o) => o.status === "배송중").length;
  const settledOrders = orders.filter((o) => o.status === "정산완료");
  const totalRevenueJpy = orders.reduce((a, o) => a + o.sellingPrice, 0);
  const totalProfitJpy = settledOrders.reduce((a, o) => a + o.marginJpy, 0);
  const avgMargin = sourcing.length
    ? sourcing.reduce((acc, s) => acc + s.marginWithRefund, 0) / sourcing.length
    : 0;
  const recentOrders = orders.slice(0, 5);

  const kpis = [
    { label: "총 매출 (JPY)", value: formatJpy(totalRevenueJpy), icon: BarChart3, color: "text-indigo-600", bg: "bg-indigo-50", sub: `${orders.length}건` },
    { label: "순이익 (정산)", value: formatJpy(totalProfitJpy), icon: TrendingUp, color: "text-green-600", bg: "bg-green-50", sub: `${settledOrders.length}건 정산완료` },
    { label: "판매중 상품", value: String(activeItems), icon: Package, color: "text-blue-600", bg: "bg-blue-50", sub: `전체 ${sourcing.length}개 중` },
    { label: "평균 마진율", value: `${avgMargin.toFixed(1)}%`, icon: Target, color: "text-purple-600", bg: "bg-purple-50", sub: avgMargin >= 20 ? "양호" : avgMargin >= 10 ? "보통" : "주의" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(({ label, value, icon: Icon, color, bg, sub }) => (
          <div key={label} className="card">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-gray-500">{label}</p>
                <p className={`text-xl font-bold mt-1 ${color}`}>{loading ? "—" : value}</p>
                <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
              </div>
              <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center`}>
                <Icon size={18} className={color} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">최근 주문</h2>
            <Link href="/orders" className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1">전체보기 <ArrowRight size={14} /></Link>
          </div>
          {loading ? (
            <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}</div>
          ) : recentOrders.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">주문 내역이 없습니다</p>
          ) : (
            <div className="space-y-2">
              {recentOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-900 truncate max-w-[200px]">{order.productName}</p>
                    <p className="text-xs text-gray-400">{order.orderDate} · {order.buyerName}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">{formatJpy(order.sellingPrice)}</span>
                    <span className={`badge ${statusBadgeClass(order.status)}`}>{order.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-3">현황 요약</h2>
          <div className="space-y-3">
            {[
              { label: "처리중 주문", value: pendingOrders, color: "bg-blue-500" },
              { label: "배송중", value: shippingOrders, color: "bg-purple-500" },
              { label: "판매중 상품", value: activeItems, color: "bg-green-500" },
              { label: "조사중 상품", value: sourcing.filter(s => s.status === "조사중").length, color: "bg-yellow-500" },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{label}</span>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full ${color} rounded-full`} style={{ width: `${Math.min((value / Math.max(orders.length, 1)) * 100, 100)}%` }} />
                  </div>
                  <span className="text-sm font-bold text-gray-700 w-6 text-right">{loading ? "—" : value}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-4">빠른 메뉴</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { href: "/ai-sourcing", label: "AI 소싱 전략", icon: Sparkles, color: "bg-purple-50 text-purple-700 border-purple-100" },
            { href: "/calculator", label: "마진 계산기", icon: BarChart3, color: "bg-blue-50 text-blue-700 border-blue-100" },
            { href: "/orders", label: "주문 등록", icon: ShoppingCart, color: "bg-green-50 text-green-700 border-green-100" },
            { href: "/japan-helper", label: "일본어 도우미", icon: Zap, color: "bg-orange-50 text-orange-700 border-orange-100" },
          ].map(({ href, label, icon: Icon, color }) => (
            <Link key={href} href={href} className={`flex flex-col items-center gap-2 p-4 rounded-xl border ${color} hover:opacity-80 transition-opacity`}>
              <Icon size={22} />
              <span className="text-sm font-medium text-center">{label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── 운영적 뷰 ────────────────────────────────────────────────────────────────

function OperationalView({ sourcing, orders, loading }: { sourcing: SourcingItem[]; orders: Order[]; loading: boolean }) {
  const waitingDispatch = orders.filter((o) => o.status === "주문접수");
  const shipping = orders.filter((o) => o.status === "배송중");
  const lowMarginItems = sourcing.filter((s) => s.marginWithRefund < 10 && s.status === "판매중");
  const noPrice = sourcing.filter((s) => s.sellingPrice === 0 && s.status !== "중단");

  if (loading) return (
    <div className="space-y-4">{[1, 2, 3].map((i) => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}</div>
  );

  const sections = [
    {
      title: "발주 대기",
      icon: Truck,
      color: "border-l-orange-400",
      iconColor: "text-orange-500",
      items: waitingDispatch,
      badge: waitingDispatch.length,
      badgeCls: "bg-orange-100 text-orange-700",
      href: "/orders",
      cta: "발주 처리",
      render: (o: Order) => (
        <div key={o.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
          <div>
            <p className="text-sm font-medium text-gray-900 truncate max-w-[200px]">{o.productName}</p>
            <p className="text-xs text-gray-400">{o.orderDate} · {o.buyerName}</p>
          </div>
          <span className="text-sm font-medium text-gray-900">{formatJpy(o.sellingPrice)}</span>
        </div>
      ),
    },
    {
      title: "배송 추적 필요",
      icon: Package,
      color: "border-l-blue-400",
      iconColor: "text-blue-500",
      items: shipping,
      badge: shipping.length,
      badgeCls: "bg-blue-100 text-blue-700",
      href: "/orders",
      cta: "배송 확인",
      render: (o: Order) => (
        <div key={o.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
          <div>
            <p className="text-sm font-medium text-gray-900 truncate max-w-[200px]">{o.productName}</p>
            <p className="text-xs text-gray-400">운송장: {o.trackingNumber || "미입력"}</p>
          </div>
          <span className={`badge ${statusBadgeClass(o.status)}`}>{o.status}</span>
        </div>
      ),
    },
    {
      title: "마진 주의 상품",
      icon: AlertCircle,
      color: "border-l-red-400",
      iconColor: "text-red-500",
      items: lowMarginItems,
      badge: lowMarginItems.length,
      badgeCls: "bg-red-100 text-red-700",
      href: "/sourcing",
      cta: "가격 조정",
      render: (s: SourcingItem) => (
        <div key={s.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
          <div>
            <p className="text-sm font-medium text-gray-900 truncate max-w-[200px]">{s.productName}</p>
            <p className="text-xs text-gray-400">{s.brand} · 경쟁 {s.competitorCount}명</p>
          </div>
          <span className="badge bg-red-100 text-red-700">{s.marginWithRefund.toFixed(1)}%</span>
        </div>
      ),
    },
    {
      title: "가격 미설정 상품",
      icon: AlertCircle,
      color: "border-l-yellow-400",
      iconColor: "text-yellow-500",
      items: noPrice,
      badge: noPrice.length,
      badgeCls: "bg-yellow-100 text-yellow-700",
      href: "/sourcing",
      cta: "가격 입력",
      render: (s: SourcingItem) => (
        <div key={s.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
          <p className="text-sm font-medium text-gray-900 truncate max-w-[280px]">{s.productName}</p>
          <span className="badge bg-yellow-100 text-yellow-700">{s.status}</span>
        </div>
      ),
    },
  ];

  const hasAnyTask = sections.some((s) => s.items.length > 0);

  if (!hasAnyTask) {
    return (
      <div className="card text-center py-16">
        <div className="text-4xl mb-3">🎉</div>
        <p className="text-gray-700 font-semibold text-lg">처리할 항목이 없습니다</p>
        <p className="text-gray-400 text-sm mt-1">모든 작업이 정리되어 있습니다</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sections.map((sec) => {
        if (sec.items.length === 0) return null;
        const Icon = sec.icon;
        return (
          <div key={sec.title} className={`card border-l-4 ${sec.color}`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Icon size={16} className={sec.iconColor} />
                {sec.title}
                <span className={`ml-1 text-xs font-bold px-2 py-0.5 rounded-full ${sec.badgeCls}`}>{sec.badge}건</span>
              </h2>
              <Link href={sec.href} className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
                {sec.cta} <ArrowRight size={14} />
              </Link>
            </div>
            <div className="space-y-0">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {(sec.items as any[]).slice(0, 5).map((item) => (sec.render as (i: any) => React.ReactNode)(item))}
              {sec.items.length > 5 && (
                <p className="text-xs text-gray-400 text-center pt-2">외 {sec.items.length - 5}건 더</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── 분석적 뷰 ────────────────────────────────────────────────────────────────

function AnalyticalView({ sourcing, orders, loading }: { sourcing: SourcingItem[]; orders: Order[]; loading: boolean }) {
  if (loading) return (
    <div className="space-y-4">{[1, 2].map((i) => <div key={i} className="h-48 bg-gray-100 rounded-xl animate-pulse" />)}</div>
  );

  // 상태별 주문 분포
  const statusGroups: Record<string, number> = {};
  for (const o of orders) {
    statusGroups[o.status] = (statusGroups[o.status] || 0) + 1;
  }

  // 브랜드별 판매 현황 (top 5)
  const brandMap: Record<string, { sales: number; revenue: number }> = {};
  for (const s of sourcing) {
    if (!s.brand) continue;
    if (!brandMap[s.brand]) brandMap[s.brand] = { sales: 0, revenue: 0 };
  }
  for (const o of orders) {
    const matched = sourcing.find((s) => o.productName.includes(s.brand));
    const brand = matched?.brand || "기타";
    if (!brandMap[brand]) brandMap[brand] = { sales: 0, revenue: 0 };
    brandMap[brand].sales += 1;
    brandMap[brand].revenue += o.sellingPrice;
  }
  const topBrands = Object.entries(brandMap)
    .filter(([, v]) => v.sales > 0 || v.revenue > 0)
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 6);

  const maxRevenue = Math.max(...topBrands.map(([, v]) => v.revenue), 1);

  // 마진율 분포
  const marginBuckets = { "30%+": 0, "20~30%": 0, "10~20%": 0, "0~10%": 0, "0% 미만": 0 };
  for (const s of sourcing.filter(s => s.status === "판매중")) {
    const m = s.marginWithRefund;
    if (m >= 30) marginBuckets["30%+"]++;
    else if (m >= 20) marginBuckets["20~30%"]++;
    else if (m >= 10) marginBuckets["10~20%"]++;
    else if (m >= 0) marginBuckets["0~10%"]++;
    else marginBuckets["0% 미만"]++;
  }
  const maxBucket = Math.max(...Object.values(marginBuckets), 1);

  const marginColors: Record<string, string> = {
    "30%+": "bg-green-500",
    "20~30%": "bg-emerald-400",
    "10~20%": "bg-yellow-400",
    "0~10%": "bg-orange-400",
    "0% 미만": "bg-red-500",
  };

  const statusColors: Record<string, string> = {
    주문접수: "bg-purple-400",
    발주완료: "bg-indigo-400",
    배송중: "bg-blue-400",
    배송완료: "bg-teal-400",
    정산완료: "bg-green-500",
  };

  const totalOrders = orders.length || 1;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 브랜드별 매출 */}
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <BarChart3 size={16} className="text-indigo-500" /> 브랜드별 매출
          </h2>
          {topBrands.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">주문 데이터가 없습니다</p>
          ) : (
            <div className="space-y-3">
              {topBrands.map(([brand, data]) => (
                <div key={brand}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-700 font-medium">{brand}</span>
                    <span className="text-xs text-gray-500">{formatJpy(data.revenue)} ({data.sales}건)</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full transition-all"
                      style={{ width: `${(data.revenue / maxRevenue) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 주문 상태 분포 */}
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp size={16} className="text-green-500" /> 주문 상태 분포
          </h2>
          {orders.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">주문 데이터가 없습니다</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(statusGroups).map(([status, count]) => (
                <div key={status}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-700">{status}</span>
                    <span className="text-xs text-gray-500">{count}건 ({Math.round((count / totalOrders) * 100)}%)</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${statusColors[status] || "bg-gray-400"}`}
                      style={{ width: `${(count / totalOrders) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 마진율 분포 */}
      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Target size={16} className="text-purple-500" /> 판매중 상품 마진율 분포
        </h2>
        {sourcing.filter(s => s.status === "판매중").length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-4">판매중 상품이 없습니다</p>
        ) : (
          <div className="flex items-end gap-4 h-32">
            {Object.entries(marginBuckets).map(([label, count]) => (
              <div key={label} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs font-bold text-gray-700">{count}</span>
                <div className="w-full flex flex-col justify-end" style={{ height: "80px" }}>
                  <div
                    className={`w-full rounded-t-lg transition-all ${marginColors[label]}`}
                    style={{ height: `${Math.max((count / maxBucket) * 80, count > 0 ? 8 : 0)}px` }}
                  />
                </div>
                <span className="text-xs text-gray-500 text-center leading-tight">{label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 소싱 카테고리 분포 */}
      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Package size={16} className="text-blue-500" /> 카테고리별 소싱 현황
        </h2>
        {sourcing.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-4">소싱 데이터가 없습니다</p>
        ) : (() => {
          const catMap: Record<string, number> = {};
          for (const s of sourcing) catMap[s.category || "기타"] = (catMap[s.category || "기타"] || 0) + 1;
          const total = sourcing.length;
          return (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {Object.entries(catMap).sort((a, b) => b[1] - a[1]).map(([cat, count]) => (
                <div key={cat} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                  <span className="text-sm text-gray-700">{cat}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-gray-900">{count}</span>
                    <span className="text-xs text-gray-400">({Math.round((count / total) * 100)}%)</span>
                  </div>
                </div>
              ))}
            </div>
          );
        })()}
      </div>
    </div>
  );
}

// ─── 메인 대시보드 ────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [sourcing, setSourcing] = useState<SourcingItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<DashTab>("strategic");
  const [refreshing, setRefreshing] = useState(false);

  async function loadData() {
    const [s, o] = await Promise.all([
      fetch("/api/sheets/sourcing").then((r) => r.json()).catch(() => ({ items: [] })),
      fetch("/api/sheets/orders").then((r) => r.json()).catch(() => ({ orders: [] })),
    ]);
    setSourcing(s.items ?? []);
    setOrders(o.orders ?? []);
  }

  useEffect(() => {
    loadData().then(() => setLoading(false));
  }, []);

  async function handleRefresh() {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }

  const TABS: { id: DashTab; label: string; desc: string }[] = [
    { id: "strategic", label: "전략적 뷰", desc: "KPI · 매출 · 수익" },
    { id: "operational", label: "운영적 뷰", desc: "지금 당장 처리할 것" },
    { id: "analytical", label: "분석적 뷰", desc: "트렌드 · 브랜드 성과" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">대시보드</h1>
          <p className="text-gray-500 mt-0.5 text-sm">바이마 한국→일본 역직구 현황</p>
        </div>
        <button onClick={handleRefresh} disabled={refreshing} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          새로고침
        </button>
      </div>

      <ExchangeRateBar />

      {/* 탭 */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={clsx(
              "flex-1 py-2 px-3 rounded-lg text-sm transition-all text-left",
              tab === t.id
                ? "bg-white shadow-sm font-semibold text-gray-900"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            <div className="font-medium">{t.label}</div>
            <div className="text-xs opacity-60 hidden sm:block">{t.desc}</div>
          </button>
        ))}
      </div>

      {tab === "strategic" && <StrategicView sourcing={sourcing} orders={orders} loading={loading} />}
      {tab === "operational" && <OperationalView sourcing={sourcing} orders={orders} loading={loading} />}
      {tab === "analytical" && <AnalyticalView sourcing={sourcing} orders={orders} loading={loading} />}
    </div>
  );
}

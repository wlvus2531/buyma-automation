"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TrendingUp, ShoppingCart, Package, BarChart3, ArrowRight, Sparkles, AlertCircle } from "lucide-react";
import type { SourcingItem, Order } from "@/lib/types";
import { formatKrw, formatJpy, statusBadgeClass } from "@/lib/utils";

export default function Dashboard() {
  const [sourcing, setSourcing] = useState<SourcingItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/sheets/sourcing").then((r) => r.json()).catch(() => ({ items: [] })),
      fetch("/api/sheets/orders").then((r) => r.json()).catch(() => ({ orders: [] })),
    ]).then(([s, o]) => {
      setSourcing(s.items ?? []);
      setOrders(o.orders ?? []);
      setLoading(false);
    });
  }, []);

  const activeItems = sourcing.filter((s) => s.status === "판매중").length;
  const pendingOrders = orders.filter((o) => o.status === "주문접수" || o.status === "발주완료").length;
  const shippingOrders = orders.filter((o) => o.status === "배송중").length;
  const avgMargin = sourcing.length
    ? sourcing.reduce((acc, s) => acc + s.marginWithRefund, 0) / sourcing.length
    : 0;

  const stats = [
    { label: "판매중 상품", value: activeItems, icon: Package, color: "text-green-600", bg: "bg-green-50" },
    { label: "처리중 주문", value: pendingOrders, icon: ShoppingCart, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "배송중", value: shippingOrders, icon: TrendingUp, color: "text-purple-600", bg: "bg-purple-50" },
    { label: "평균 마진율", value: `${avgMargin.toFixed(1)}%`, icon: BarChart3, color: "text-indigo-600", bg: "bg-indigo-50" },
  ];

  const recentOrders = orders.slice(0, 5);
  const lowMarginItems = sourcing.filter((s) => s.marginWithRefund < 10 && s.status === "판매중");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">대시보드</h1>
        <p className="text-gray-500 mt-1">바이마 한국→일본 역직구 현황</p>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{label}</p>
                <p className={`text-2xl font-bold mt-1 ${color}`}>
                  {loading ? "—" : value}
                </p>
              </div>
              <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center`}>
                <Icon size={20} className={color} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 최근 주문 */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">최근 주문</h2>
            <Link href="/orders" className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
              전체보기 <ArrowRight size={14} />
            </Link>
          </div>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          ) : recentOrders.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">주문 내역이 없습니다</p>
          ) : (
            <div className="space-y-2">
              {recentOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-900 truncate max-w-[180px]">{order.productName}</p>
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

        {/* 마진 낮은 상품 알림 */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <AlertCircle size={16} className="text-orange-500" />
              마진 주의 상품
            </h2>
            <Link href="/sourcing" className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
              전체보기 <ArrowRight size={14} />
            </Link>
          </div>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}
            </div>
          ) : lowMarginItems.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">마진 주의 상품이 없습니다 🎉</p>
          ) : (
            <div className="space-y-2">
              {lowMarginItems.slice(0, 5).map((item) => (
                <div key={item.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-900 truncate max-w-[180px]">{item.productName}</p>
                    <p className="text-xs text-gray-400">{item.brand} · 경쟁 {item.competitorCount}명</p>
                  </div>
                  <span className="badge bg-orange-100 text-orange-700">
                    {item.marginWithRefund.toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 빠른 링크 */}
      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-4">빠른 메뉴</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { href: "/ai-sourcing", label: "AI 소싱 전략 받기", icon: Sparkles, color: "bg-purple-50 text-purple-700 border-purple-100" },
            { href: "/calculator", label: "마진 계산하기", icon: BarChart3, color: "bg-blue-50 text-blue-700 border-blue-100" },
            { href: "/orders", label: "주문 등록하기", icon: ShoppingCart, color: "bg-green-50 text-green-700 border-green-100" },
            { href: "/thumbnail", label: "썸네일 만들기", icon: Package, color: "bg-orange-50 text-orange-700 border-orange-100" },
          ].map(({ href, label, icon: Icon, color }) => (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border ${color} hover:opacity-80 transition-opacity`}
            >
              <Icon size={22} />
              <span className="text-sm font-medium text-center">{label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

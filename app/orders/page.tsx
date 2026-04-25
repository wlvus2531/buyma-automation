"use client";

import { useState, useEffect } from "react";
import { Plus, RefreshCw, Search, Pencil, ChevronRight } from "lucide-react";
import type { Order, OrderStatus } from "@/lib/types";
import { formatJpy, formatKrw, statusBadgeClass, marginBg, formatPercent, generateId, calcMargin } from "@/lib/utils";
import OrderModal from "@/components/orders/OrderModal";

const STATUSES: OrderStatus[] = ["주문접수", "발주완료", "배송중", "배송완료", "정산완료"];
const STATUS_NEXT: Record<OrderStatus, OrderStatus | null> = {
  주문접수: "발주완료",
  발주완료: "배송중",
  배송중: "배송완료",
  배송완료: "정산완료",
  정산완료: null,
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "전체">("전체");
  const [showModal, setShowModal] = useState(false);
  const [editOrder, setEditOrder] = useState<Order | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/sheets/orders");
    const data = await res.json();
    setOrders(data.orders ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = orders.filter((o) => {
    const matchSearch = o.productName.toLowerCase().includes(search.toLowerCase()) ||
      o.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
      o.buyerName.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "전체" || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  async function handleSave(order: Partial<Order>) {
    setSaving(true);
    const calc = calcMargin({
      sellingPrice: order.sellingPrice ?? 0,
      purchasePrice: order.purchasePrice ?? 0,
      shippingCost: order.shippingCost ?? 0,
      exchangeRate: order.exchangeRate ?? 10,
      buymaFeeRate: 5.4,
      vatRefundRate: 9.09,
    });
    const now = new Date().toLocaleDateString("ko-KR");
    const toSave: Order = {
      id: editOrder?.id ?? generateId(),
      orderNumber: order.orderNumber ?? "",
      productName: order.productName ?? "",
      buyerName: order.buyerName ?? "",
      sellingPrice: order.sellingPrice ?? 0,
      purchasePrice: order.purchasePrice ?? 0,
      shippingCost: order.shippingCost ?? 0,
      exchangeRate: order.exchangeRate ?? 10,
      status: order.status ?? "주문접수",
      trackingNumber: order.trackingNumber ?? "",
      orderDate: editOrder?.orderDate ?? order.orderDate ?? now,
      shippedDate: order.shippedDate ?? "",
      settledDate: order.settledDate ?? "",
      marginJpy: parseFloat(calc.profitWithRefund.toFixed(0)),
      marginRate: parseFloat(calc.marginWithRefund.toFixed(2)),
      notes: order.notes ?? "",
    };
    await fetch("/api/sheets/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toSave),
    });
    await load();
    setShowModal(false);
    setEditOrder(null);
    setSaving(false);
  }

  async function handleAdvanceStatus(order: Order) {
    const next = STATUS_NEXT[order.status];
    if (!next) return;
    const now = new Date().toLocaleDateString("ko-KR");
    const updated: Order = {
      ...order,
      status: next,
      shippedDate: next === "배송중" ? now : order.shippedDate,
      settledDate: next === "정산완료" ? now : order.settledDate,
    };
    await fetch("/api/sheets/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
    });
    await load();
  }

  const counts = STATUSES.reduce((acc, s) => {
    acc[s] = orders.filter((o) => o.status === s).length;
    return acc;
  }, {} as Record<string, number>);

  const totalRevenue = orders.filter((o) => o.status === "정산완료")
    .reduce((acc, o) => acc + o.sellingPrice, 0);
  const totalProfit = orders.filter((o) => o.status === "정산완료")
    .reduce((acc, o) => acc + o.marginJpy, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">주문 관리</h1>
          <p className="text-gray-500 text-sm mt-1">총 {orders.length}건 · 정산완료 매출 {formatJpy(totalRevenue)}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="btn-secondary flex items-center gap-2">
            <RefreshCw size={15} /> 새로고침
          </button>
          <button onClick={() => { setEditOrder(null); setShowModal(true); }} className="btn-primary flex items-center gap-2">
            <Plus size={15} /> 주문 추가
          </button>
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-5 gap-3">
        {STATUSES.map((s) => (
          <div
            key={s}
            onClick={() => setStatusFilter(statusFilter === s ? "전체" : s)}
            className={`card cursor-pointer transition-all text-center py-3 ${statusFilter === s ? "border-2 border-indigo-500" : ""}`}
          >
            <p className="text-2xl font-bold text-gray-900">{counts[s] ?? 0}</p>
            <p className="text-xs text-gray-500 mt-1">{s}</p>
          </div>
        ))}
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="주문번호·상품명·구매자명으로 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input pl-9"
        />
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {["주문번호", "상품명", "구매자", "판매가", "매입가", "마진", "상태", "주문일", "운송장", ""].map((h) => (
                  <th key={h} className="table-header px-4 py-3 text-left whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 10 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-12 text-gray-400">
                    {search || statusFilter !== "전체" ? "검색 결과가 없습니다" : "주문을 추가해 주세요"}
                  </td>
                </tr>
              ) : (
                filtered.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{order.orderNumber || "—"}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 max-w-[160px] truncate">{order.productName}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{order.buyerName}</td>
                    <td className="px-4 py-3 font-medium">{formatJpy(order.sellingPrice)}</td>
                    <td className="px-4 py-3 text-gray-600">{formatKrw(order.purchasePrice)}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${marginBg(order.marginRate)}`}>
                        {formatPercent(order.marginRate)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${statusBadgeClass(order.status)}`}>{order.status}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{order.orderDate}</td>
                    <td className="px-4 py-3 text-xs font-mono text-gray-500">{order.trackingNumber || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {STATUS_NEXT[order.status] && (
                          <button
                            onClick={() => handleAdvanceStatus(order)}
                            className="flex items-center gap-1 px-2 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs hover:bg-indigo-100 transition-colors whitespace-nowrap"
                            title={`→ ${STATUS_NEXT[order.status]}`}
                          >
                            <ChevronRight size={12} />{STATUS_NEXT[order.status]}
                          </button>
                        )}
                        <button
                          onClick={() => { setEditOrder(order); setShowModal(true); }}
                          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-600"
                        >
                          <Pencil size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <OrderModal
          order={editOrder}
          onClose={() => { setShowModal(false); setEditOrder(null); }}
          onSave={handleSave}
          saving={saving}
        />
      )}
    </div>
  );
}

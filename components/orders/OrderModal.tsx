"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import type { Order, OrderStatus } from "@/lib/types";
import { calcMargin, formatPercent, marginColor } from "@/lib/utils";

const STATUSES: OrderStatus[] = ["주문접수", "발주완료", "배송중", "배송완료", "정산완료"];

interface Props {
  order: Order | null;
  onClose: () => void;
  onSave: (order: Partial<Order>) => Promise<void>;
  saving: boolean;
}

export default function OrderModal({ order, onClose, onSave, saving }: Props) {
  const today = new Date().toLocaleDateString("ko-KR");
  const [form, setForm] = useState<Partial<Order>>({
    orderNumber: "", productName: "", buyerName: "",
    sellingPrice: 0, purchasePrice: 0, shippingCost: 3000,
    exchangeRate: 10.5, status: "주문접수",
    trackingNumber: "", orderDate: today,
    shippedDate: "", settledDate: "", notes: "",
    shippingAddress: "", phone: "",
  });

  useEffect(() => {
    if (order) setForm(order);
  }, [order]);

  const calc = calcMargin({
    sellingPrice: form.sellingPrice ?? 0,
    purchasePrice: form.purchasePrice ?? 0,
    shippingCost: form.shippingCost ?? 0,
    exchangeRate: form.exchangeRate ?? 10,
    buymaFeeRate: 5.4,
    vatRefundRate: 9.09,
  });

  function update(key: keyof Order, value: string | number) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="font-bold text-gray-900 text-lg">{order ? "주문 수정" : "주문 추가"}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">주문번호</label>
              <input className="input" value={form.orderNumber ?? ""} onChange={(e) => update("orderNumber", e.target.value)} placeholder="바이마 주문번호" />
            </div>
            <div>
              <label className="label">주문일</label>
              <input className="input" value={form.orderDate ?? ""} onChange={(e) => update("orderDate", e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="label">상품명 *</label>
              <input className="input" value={form.productName ?? ""} onChange={(e) => update("productName", e.target.value)} placeholder="판매 상품명" />
            </div>
            <div>
              <label className="label">구매자명</label>
              <input className="input" value={form.buyerName ?? ""} onChange={(e) => update("buyerName", e.target.value)} />
            </div>
            <div>
              <label className="label">상태</label>
              <select className="input" value={form.status ?? "주문접수"} onChange={(e) => update("status", e.target.value as OrderStatus)}>
                {STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="label">일본 배송지 주소 <span className="text-gray-400 font-normal">(조광 발주용)</span></label>
              <input className="input" value={form.shippingAddress ?? ""} onChange={(e) => update("shippingAddress", e.target.value)} placeholder="수취인 일본 주소" />
            </div>
            <div>
              <label className="label">수취인 연락처 <span className="text-gray-400 font-normal">(조광 발주용)</span></label>
              <input className="input" value={form.phone ?? ""} onChange={(e) => update("phone", e.target.value)} placeholder="수취인 전화번호" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">판매가 (JPY) *</label>
              <input type="number" className="input" value={form.sellingPrice ?? 0} onChange={(e) => update("sellingPrice", Number(e.target.value))} />
            </div>
            <div>
              <label className="label">매입가 (KRW) *</label>
              <input type="number" className="input" value={form.purchasePrice ?? 0} onChange={(e) => update("purchasePrice", Number(e.target.value))} />
            </div>
            <div>
              <label className="label">배송비 (KRW)</label>
              <input type="number" className="input" value={form.shippingCost ?? 0} onChange={(e) => update("shippingCost", Number(e.target.value))} />
            </div>
            <div>
              <label className="label">환율 (KRW / 1JPY)</label>
              <input type="number" step="0.1" className="input" value={form.exchangeRate ?? 10} onChange={(e) => update("exchangeRate", Number(e.target.value))} />
            </div>
          </div>

          {(form.sellingPrice ?? 0) > 0 && (
            <div className="bg-gray-50 rounded-xl p-3 flex gap-4">
              <div>
                <p className="text-xs text-gray-500">환급 포함 마진율</p>
                <p className={`text-lg font-bold ${marginColor(calc.marginWithRefund)}`}>{formatPercent(calc.marginWithRefund)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">환급 제외 마진율</p>
                <p className={`text-lg font-bold ${marginColor(calc.marginWithoutRefund)}`}>{formatPercent(calc.marginWithoutRefund)}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">운송장 번호</label>
              <input className="input" value={form.trackingNumber ?? ""} onChange={(e) => update("trackingNumber", e.target.value)} placeholder="발송 후 입력" />
            </div>
            <div>
              <label className="label">발송일</label>
              <input className="input" value={form.shippedDate ?? ""} onChange={(e) => update("shippedDate", e.target.value)} placeholder="YYYY. M. D." />
            </div>
            <div>
              <label className="label">정산일</label>
              <input className="input" value={form.settledDate ?? ""} onChange={(e) => update("settledDate", e.target.value)} placeholder="정산 후 입력" />
            </div>
            <div>
              <label className="label">메모</label>
              <input className="input" value={form.notes ?? ""} onChange={(e) => update("notes", e.target.value)} />
            </div>
          </div>
        </div>

        <div className="flex gap-3 p-5 border-t border-gray-100">
          <button onClick={onClose} className="btn-secondary flex-1">취소</button>
          <button
            onClick={() => onSave(form)}
            disabled={saving || !form.productName}
            className="btn-primary flex-1"
          >
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}

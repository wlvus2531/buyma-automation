"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import type { SourcingItem, SourcingStatus } from "@/lib/types";
import { calcMargin, formatPercent, marginColor } from "@/lib/utils";

const STATUSES: SourcingStatus[] = ["조사중", "등록완료", "판매중", "일시정지", "중단"];
const CATEGORIES = ["패션/의류", "패션잡화", "뷰티/화장품", "라이프스타일", "식품/건강", "문화상품/굿즈", "기타"];

interface Props {
  item: SourcingItem | null;
  onClose: () => void;
  onSave: (item: Partial<SourcingItem>) => Promise<void>;
  saving: boolean;
}

export default function SourcingModal({ item, onClose, onSave, saving }: Props) {
  const [form, setForm] = useState<Partial<SourcingItem>>({
    productName: "", category: "패션/의류", brand: "", koreaPurchasePrice: 0,
    buymaLowestPrice: 0, sellingPrice: 0, competitorCount: 0, status: "조사중",
    shippingCost: 3000, exchangeRate: 10, notes: "", sourceUrl: "",
  });

  useEffect(() => {
    if (item) setForm(item);
  }, [item]);

  const calc = calcMargin({
    sellingPrice: form.sellingPrice ?? 0,
    purchasePrice: form.koreaPurchasePrice ?? 0,
    shippingCost: form.shippingCost ?? 0,
    exchangeRate: form.exchangeRate ?? 10,
    buymaFeeRate: 5.4,
    vatRefundRate: 9.09,
  });

  function update(key: keyof SourcingItem, value: string | number) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="font-bold text-gray-900 text-lg">{item ? "소싱 상품 수정" : "소싱 상품 추가"}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* 기본 정보 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">상품명 *</label>
              <input className="input" value={form.productName ?? ""} onChange={(e) => update("productName", e.target.value)} placeholder="상품명 입력" />
            </div>
            <div>
              <label className="label">카테고리</label>
              <select className="input" value={form.category ?? ""} onChange={(e) => update("category", e.target.value)}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">브랜드</label>
              <input className="input" value={form.brand ?? ""} onChange={(e) => update("brand", e.target.value)} placeholder="브랜드명" />
            </div>
          </div>

          {/* 가격 정보 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">한국 매입가 (KRW)</label>
              <input type="number" className="input" value={form.koreaPurchasePrice ?? 0} onChange={(e) => update("koreaPurchasePrice", Number(e.target.value))} />
            </div>
            <div>
              <label className="label">배송비 (KRW)</label>
              <input type="number" className="input" value={form.shippingCost ?? 0} onChange={(e) => update("shippingCost", Number(e.target.value))} />
            </div>
            <div>
              <label className="label">내 판매가 (JPY)</label>
              <input type="number" className="input" value={form.sellingPrice ?? 0} onChange={(e) => update("sellingPrice", Number(e.target.value))} />
            </div>
            <div>
              <label className="label">바이마 최저가 (JPY)</label>
              <input type="number" className="input" value={form.buymaLowestPrice ?? 0} onChange={(e) => update("buymaLowestPrice", Number(e.target.value))} />
            </div>
            <div>
              <label className="label">환율 (KRW / 1JPY)</label>
              <input type="number" step="0.1" className="input" value={form.exchangeRate ?? 10} onChange={(e) => update("exchangeRate", Number(e.target.value))} />
            </div>
            <div>
              <label className="label">경쟁자 수</label>
              <input type="number" className="input" value={form.competitorCount ?? 0} onChange={(e) => update("competitorCount", Number(e.target.value))} />
            </div>
          </div>

          {/* 마진 미리보기 */}
          {(form.sellingPrice ?? 0) > 0 && (
            <div className="bg-gray-50 rounded-xl p-4 grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-gray-500">환급 포함 마진율</p>
                <p className={`text-xl font-bold ${marginColor(calc.marginWithRefund)}`}>{formatPercent(calc.marginWithRefund)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">환급 제외 마진율</p>
                <p className={`text-xl font-bold ${marginColor(calc.marginWithoutRefund)}`}>{formatPercent(calc.marginWithoutRefund)}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">상태</label>
              <select className="input" value={form.status ?? "조사중"} onChange={(e) => update("status", e.target.value as SourcingStatus)}>
                {STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">메모</label>
              <input className="input" value={form.notes ?? ""} onChange={(e) => update("notes", e.target.value)} placeholder="메모 (선택)" />
            </div>
          </div>

          <div>
            <label className="label">구매처 URL (무신사 / 29cm / EQL 등)</label>
            <input
              className="input"
              value={form.sourceUrl ?? ""}
              onChange={(e) => update("sourceUrl", e.target.value)}
              placeholder="https://www.musinsa.com/products/12345"
            />
            <p className="text-xs text-gray-400 mt-1">입력 시 소싱 리스트에서 상품 이미지 자동 표시</p>
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

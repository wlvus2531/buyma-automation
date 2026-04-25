"use client";

import { useState } from "react";
import { Calculator, Info } from "lucide-react";
import { calcMargin, formatJpy, formatKrw, formatPercent, marginColor } from "@/lib/utils";

export default function CalculatorPage() {
  const [sellingPrice, setSellingPrice] = useState(5000);
  const [purchasePrice, setPurchasePrice] = useState(30000);
  const [shippingCost, setShippingCost] = useState(3000);
  const [exchangeRate, setExchangeRate] = useState(10.5);
  const [buymaFeeRate, setBuymaFeeRate] = useState(5.4);
  const [vatRefundRate, setVatRefundRate] = useState(9.09);

  const result = calcMargin({ sellingPrice, purchasePrice, shippingCost, exchangeRate, buymaFeeRate, vatRefundRate });

  const rows = [
    { label: "바이마 판매가", value: formatJpy(sellingPrice), note: "100%" },
    { label: "바이마 수수료", value: `-${formatJpy(result.buymaFeeJpy)}`, note: `-${buymaFeeRate}%`, danger: true },
    { label: "실수령 판매가", value: formatJpy(result.netSellingJpy), note: "", bold: true },
    { label: "매입 원가 (엔화환산)", value: `-${formatJpy(result.costJpy)}`, note: `KRW ${(purchasePrice + shippingCost).toLocaleString()}`, danger: true },
    { label: "부가세 환급", value: `+${formatJpy(result.vatRefundJpy)}`, note: `KRW ${(purchasePrice * vatRefundRate / 100).toFixed(0)}원`, success: true },
  ];

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
          <Calculator size={20} className="text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">마진 계산기</h1>
          <p className="text-gray-500 text-sm">환급 포함/제외 두 가지 마진율을 실시간 계산합니다</p>
        </div>
      </div>

      <div className="card space-y-5">
        <h2 className="font-semibold text-gray-900">입력 값</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">바이마 판매가 (JPY) *</label>
            <input
              type="number"
              className="input"
              value={sellingPrice}
              onChange={(e) => setSellingPrice(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="label">한국 매입가 (KRW) *</label>
            <input
              type="number"
              className="input"
              value={purchasePrice}
              onChange={(e) => setPurchasePrice(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="label">배송비 (KRW)</label>
            <input
              type="number"
              className="input"
              value={shippingCost}
              onChange={(e) => setShippingCost(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="label">환율 (KRW / 1JPY)</label>
            <input
              type="number"
              step="0.1"
              className="input"
              value={exchangeRate}
              onChange={(e) => setExchangeRate(Number(e.target.value))}
            />
          </div>
        </div>

        <div className="border-t border-gray-100 pt-4">
          <p className="text-sm font-medium text-gray-500 mb-3 flex items-center gap-1.5">
            <Info size={14} /> 수수료 설정
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">바이마 수수료율 (%)</label>
              <input
                type="number"
                step="0.1"
                className="input"
                value={buymaFeeRate}
                onChange={(e) => setBuymaFeeRate(Number(e.target.value))}
              />
              <p className="text-xs text-gray-400 mt-1">기본값: 5.4%</p>
            </div>
            <div>
              <label className="label">부가세 환급률 (%)</label>
              <input
                type="number"
                step="0.01"
                className="input"
                value={vatRefundRate}
                onChange={(e) => setVatRefundRate(Number(e.target.value))}
              />
              <p className="text-xs text-gray-400 mt-1">10/110 = 9.09%</p>
            </div>
          </div>
        </div>
      </div>

      {/* 결과 카드 */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card text-center">
          <p className="text-sm text-gray-500 mb-2">환급 포함 마진율</p>
          <p className={`text-4xl font-bold ${marginColor(result.marginWithRefund)}`}>
            {formatPercent(result.marginWithRefund)}
          </p>
          <p className={`text-lg font-semibold mt-1 ${marginColor(result.marginWithRefund)}`}>
            {formatJpy(result.profitWithRefund)}
          </p>
          <p className="text-xs text-gray-400 mt-2">부가세 환급 포함 실제 이익</p>
        </div>
        <div className="card text-center">
          <p className="text-sm text-gray-500 mb-2">환급 제외 마진율</p>
          <p className={`text-4xl font-bold ${marginColor(result.marginWithoutRefund)}`}>
            {formatPercent(result.marginWithoutRefund)}
          </p>
          <p className={`text-lg font-semibold mt-1 ${marginColor(result.marginWithoutRefund)}`}>
            {formatJpy(result.profitWithoutRefund)}
          </p>
          <p className="text-xs text-gray-400 mt-2">환급 미적용 보수적 마진</p>
        </div>
      </div>

      {/* 상세 계산 내역 */}
      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-4">계산 상세 내역</h2>
        <div className="space-y-2">
          {rows.map(({ label, value, note, danger, success, bold }) => (
            <div
              key={label}
              className={`flex items-center justify-between py-2.5 px-3 rounded-lg ${bold ? "bg-gray-50 font-semibold" : ""}`}
            >
              <span className={`text-sm ${bold ? "text-gray-900" : "text-gray-600"}`}>{label}</span>
              <div className="text-right">
                <span className={`text-sm font-medium ${danger ? "text-red-600" : success ? "text-green-600" : "text-gray-900"}`}>
                  {value}
                </span>
                {note && <p className="text-xs text-gray-400">{note}</p>}
              </div>
            </div>
          ))}

          <div className="border-t border-gray-200 pt-3 mt-1">
            <div className="flex justify-between py-1">
              <span className="text-sm text-gray-600">순이익 (환급 제외)</span>
              <span className={`text-sm font-bold ${marginColor(result.marginWithoutRefund)}`}>{formatJpy(result.profitWithoutRefund)}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-sm text-gray-600">순이익 (환급 포함)</span>
              <span className={`text-sm font-bold ${marginColor(result.marginWithRefund)}`}>{formatJpy(result.profitWithRefund)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 마진율 가이드 */}
      <div className="card bg-gray-50">
        <h3 className="font-semibold text-gray-900 mb-3 text-sm">마진율 기준 가이드</h3>
        <div className="grid grid-cols-4 gap-2 text-xs text-center">
          {[
            { label: "25% 이상", desc: "우수", color: "bg-green-100 text-green-800" },
            { label: "15~25%", desc: "양호", color: "bg-blue-100 text-blue-800" },
            { label: "5~15%", desc: "주의", color: "bg-yellow-100 text-yellow-800" },
            { label: "5% 미만", desc: "위험", color: "bg-red-100 text-red-800" },
          ].map(({ label, desc, color }) => (
            <div key={label} className={`px-2 py-2 rounded-lg ${color}`}>
              <p className="font-bold">{label}</p>
              <p>{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

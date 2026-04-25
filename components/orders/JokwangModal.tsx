"use client";

import { useState, useEffect } from "react";
import { X, Copy, Check, ExternalLink, Truck, MessageSquare, AlertCircle } from "lucide-react";
import type { Order } from "@/lib/types";

interface Props {
  order: Order;
  onClose: () => void;
  onComplete: (updates: { shippingAddress: string; phone: string }) => Promise<void>;
  completing: boolean;
}

function buildDispatchText(order: Order, address: string, phone: string): string {
  return [
    "■ 조광 인터내셔널 발주 정보 ■",
    "",
    `수취인명: ${order.buyerName || "(미입력)"}`,
    `배송지: ${address || "(미입력)"}`,
    `연락처: ${phone || "(미입력)"}`,
    `상품명: ${order.productName}`,
    `판매가: ¥${order.sellingPrice.toLocaleString()}`,
    `운송사: OCS`,
    `주문번호: ${order.orderNumber || "(없음)"}`,
  ].join("\n");
}

function buildJpMessage(order: Order): string {
  return [
    `この度はご注文いただき、誠にありがとうございます。`,
    "",
    "ご注文内容を確認いたしました。",
    "現在、発送準備を進めております。",
    "",
    "■ ご注文内容",
    `商品：${order.productName}`,
    `注文番号：${order.orderNumber || "—"}`,
    `金額：¥${order.sellingPrice.toLocaleString()}`,
    "",
    "OCS国際宅急便にて発送予定です。",
    "追跡番号が確定し次第、改めてご連絡いたします。",
    "",
    "ご不明な点がございましたら、BUYMAのメッセージより",
    "お気軽にお問い合わせください。",
    "",
    "どうぞよろしくお願いいたします。",
  ].join("\n");
}

async function copyText(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}

export default function JokwangModal({ order, onClose, onComplete, completing }: Props) {
  const [address, setAddress] = useState(order.shippingAddress ?? "");
  const [phone, setPhone] = useState(order.phone ?? "");
  const [copiedDispatch, setCopiedDispatch] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(false);

  useEffect(() => {
    setAddress(order.shippingAddress ?? "");
    setPhone(order.phone ?? "");
  }, [order]);

  const dispatchText = buildDispatchText(order, address, phone);
  const jpMessage = buildJpMessage(order);

  function handleCopyDispatch() {
    copyText(dispatchText).then(() => {
      setCopiedDispatch(true);
      setTimeout(() => setCopiedDispatch(false), 2000);
    });
  }

  function handleCopyMessage() {
    copyText(jpMessage).then(() => {
      setCopiedMessage(true);
      setTimeout(() => setCopiedMessage(false), 2000);
    });
  }

  const missingFields = !address || !phone;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[92vh] overflow-y-auto">

        {/* 헤더 */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-orange-100 rounded-xl flex items-center justify-center shrink-0">
              <Truck size={18} className="text-orange-600" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 leading-tight">조광 인터내셔널 발주 준비</h2>
              <p className="text-xs text-gray-400 truncate max-w-[260px]">{order.productName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg shrink-0">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">

          {/* 필드 누락 경고 */}
          {missingFields && (
            <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-xs text-orange-700">
              <AlertCircle size={13} className="shrink-0" />
              배송지 주소와 연락처를 입력해야 발주 정보를 완성할 수 있습니다.
            </div>
          )}

          {/* 발주 접수 정보 */}
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-2.5">
            <h3 className="font-semibold text-orange-800 text-sm flex items-center gap-1.5 mb-3">
              <Truck size={13} /> 발주 접수 정보
            </h3>

            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500 w-24 shrink-0">수취인명</span>
              <span className="text-sm font-medium text-gray-800">{order.buyerName || "—"}</span>
            </div>

            <div className="flex items-start gap-3">
              <span className="text-xs text-gray-500 w-24 shrink-0 pt-1.5">일본 배송지 ＊</span>
              <input
                value={address}
                onChange={e => setAddress(e.target.value)}
                placeholder="일본 배송지 주소 입력 (필수)"
                className={`flex-1 text-sm border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-orange-300 ${!address ? "border-orange-300" : "border-gray-300"}`}
              />
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500 w-24 shrink-0">연락처 ＊</span>
              <input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="수취인 전화번호 (필수)"
                className={`flex-1 text-sm border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-orange-300 ${!phone ? "border-orange-300" : "border-gray-300"}`}
              />
            </div>

            <div className="flex items-start gap-3">
              <span className="text-xs text-gray-500 w-24 shrink-0 pt-0.5">상품명</span>
              <span className="text-sm text-gray-800 leading-snug">{order.productName}</span>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500 w-24 shrink-0">판매가</span>
              <span className="text-sm font-semibold text-gray-900">¥{order.sellingPrice.toLocaleString()}</span>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500 w-24 shrink-0">운송사</span>
              <span className="text-sm font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">OCS</span>
            </div>

            {order.orderNumber && (
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-24 shrink-0">주문번호</span>
                <span className="text-xs font-mono text-gray-600">{order.orderNumber}</span>
              </div>
            )}
          </div>

          {/* 복사용 텍스트 미리보기 */}
          <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
            <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">{dispatchText}</pre>
          </div>

          {/* 버튼 행 */}
          <div className="flex gap-2">
            <button
              onClick={handleCopyDispatch}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              {copiedDispatch ? <Check size={15} /> : <Copy size={15} />}
              {copiedDispatch ? "복사됨!" : "발주 정보 복사"}
            </button>
            <a
              href="https://www.jokwang-int.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-orange-600 text-white rounded-xl text-sm font-medium hover:bg-orange-700 transition-colors whitespace-nowrap"
            >
              <ExternalLink size={14} /> 조광 사이트
            </a>
          </div>

          {/* 카카오톡 / 메시지 템플릿 */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="bg-yellow-50 px-4 py-2.5 border-b border-gray-200 flex items-center justify-between">
              <span className="font-medium text-gray-800 text-sm flex items-center gap-1.5">
                <MessageSquare size={13} className="text-yellow-600" />
                구매자 알림 메시지 (일본어)
              </span>
              <button
                onClick={handleCopyMessage}
                className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
              >
                {copiedMessage ? <><Check size={12} /> 복사됨!</> : <><Copy size={12} /> 복사</>}
              </button>
            </div>
            <div className="p-4">
              <pre className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">{jpMessage}</pre>
            </div>
          </div>

          {/* 발주 완료 처리 */}
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <p className="text-sm text-green-700 mb-3 leading-relaxed">
              조광 인터내셔널 사이트에서 발주 접수를 완료한 후,<br />
              아래 버튼으로 주문 상태를 <strong>발주완료</strong>로 변경하세요.
            </p>
            <button
              onClick={() => onComplete({ shippingAddress: address, phone })}
              disabled={completing}
              className="w-full py-2.5 bg-green-600 text-white rounded-xl font-semibold text-sm hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
            >
              {completing ? (
                "처리 중..."
              ) : (
                <><Check size={15} /> 발주 완료 — 상태를 &quot;발주완료&quot;로 변경</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

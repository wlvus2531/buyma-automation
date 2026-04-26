"use client";

import { useState, useEffect, useCallback } from "react";
import {
  X, Copy, Check, RefreshCw, ExternalLink, ChevronDown,
  ChevronUp, Sparkles, Tag, ClipboardList, Lightbulb, FileText,
} from "lucide-react";
import type { SourcingItem } from "@/lib/types";
import { formatJpy, formatKrw } from "@/lib/utils";
import clsx from "clsx";

interface ListingResult {
  title: string;
  subtitle: string;
  description: string;
  checklist: {
    recommendedCategory: string;
    priceGuide: string;
    purchaseDeadline: string;
    condition: string;
    tags: string[];
  };
  sellerTip: string;
}

interface Props {
  item: SourcingItem;
  onClose: () => void;
}

function CopyButton({ text, label = "복사" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button
      onClick={handleCopy}
      className={clsx(
        "flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg font-medium transition-all",
        copied
          ? "bg-green-100 text-green-700"
          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
      )}
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
      {copied ? "복사됨!" : label}
    </button>
  );
}

function Section({
  icon: Icon, title, iconColor, children, defaultOpen = true,
}: {
  icon: React.ElementType;
  title: string;
  iconColor: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <span className={clsx("flex items-center gap-2 text-sm font-semibold", iconColor)}>
          <Icon size={14} />
          {title}
        </span>
        {open ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
      </button>
      {open && <div className="p-4">{children}</div>}
    </div>
  );
}

export default function BuymaListingModal({ item, onClose }: Props) {
  const [result, setResult] = useState<ListingResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const generate = useCallback(async () => {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/buyma-listing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName: item.productName,
          brand: item.brand,
          category: item.category,
          sellingPrice: item.sellingPrice,
          buymaLowestPrice: item.buymaLowestPrice,
          koreaPurchasePrice: item.koreaPurchasePrice,
          notes: item.notes,
          competitorCount: item.competitorCount,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "생성 실패");
      setResult(data.result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "생성 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [item]);

  useEffect(() => { generate(); }, [generate]);

  function buildAllText(): string {
    if (!result) return "";
    return [
      `【タイトル】`,
      result.title,
      ``,
      result.subtitle ? `【サブタイトル】\n${result.subtitle}\n` : "",
      `【商品説明】`,
      result.description,
      ``,
      `【カテゴリ】`,
      result.checklist.recommendedCategory,
      ``,
      `【コンディション】`,
      result.checklist.condition,
      ``,
      `【購入期限】`,
      result.checklist.purchaseDeadline,
      ``,
      `【タグ】`,
      result.checklist.tags.join(" "),
    ].filter(Boolean).join("\n");
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">

        {/* 헤더 */}
        <div className="flex items-start justify-between p-5 border-b border-gray-100 shrink-0">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
              <Sparkles size={16} className="text-indigo-600" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 text-base">바이마 등록 도우미</h2>
              <p className="text-xs text-gray-500 mt-0.5 truncate max-w-xs">{item.productName}</p>
              <div className="flex items-center gap-2 mt-1">
                {item.brand && (
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{item.brand}</span>
                )}
                {item.sellingPrice > 0 && (
                  <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">{formatJpy(item.sellingPrice)}</span>
                )}
                {item.koreaPurchasePrice > 0 && (
                  <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">{formatKrw(item.koreaPurchasePrice)}</span>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* 콘텐츠 */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {loading && (
            <div className="text-center py-16">
              <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <RefreshCw size={22} className="animate-spin text-indigo-500" />
              </div>
              <p className="text-gray-700 font-medium">Claude AI가 바이마 출품 자료를 생성 중...</p>
              <p className="text-gray-400 text-sm mt-1">타이틀 · 설명 · 체크리스트 최적화 중</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
              <p className="text-red-700 text-sm mb-3">{error}</p>
              <button onClick={generate} className="text-sm bg-red-100 text-red-700 px-4 py-2 rounded-lg hover:bg-red-200 transition-colors">
                다시 시도
              </button>
            </div>
          )}

          {result && (
            <>
              {/* 타이틀 */}
              <Section icon={Tag} title="상품 타이틀" iconColor="text-indigo-700">
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-base font-bold text-gray-900 leading-snug flex-1">{result.title}</p>
                    <CopyButton text={result.title} />
                  </div>
                  {result.subtitle && (
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-100">
                      <p className="text-sm text-gray-600">{result.subtitle}</p>
                      <CopyButton text={result.subtitle} label="서브 복사" />
                    </div>
                  )}
                  <div className="text-xs text-gray-400 flex items-center gap-1 mt-1">
                    <span className={clsx(
                      "px-2 py-0.5 rounded-full font-medium",
                      result.title.length <= 60 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                    )}>
                      {result.title.length}자 {result.title.length <= 60 ? "✓" : "— 60자 초과"}
                    </span>
                  </div>
                </div>
              </Section>

              {/* 상품 설명 */}
              <Section icon={FileText} title="상품 설명 (일본어)" iconColor="text-blue-700">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="text-xs text-gray-400">바이마 설명란에 그대로 붙여넣기 가능</span>
                  <CopyButton text={result.description} label="설명 복사" />
                </div>
                <pre className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed font-sans bg-gray-50 rounded-lg p-3 border border-gray-100">
                  {result.description}
                </pre>
              </Section>

              {/* 등록 체크리스트 */}
              <Section icon={ClipboardList} title="등록 체크리스트" iconColor="text-green-700">
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-1">추천 카테고리</p>
                      <p className="text-sm font-medium text-gray-800">{result.checklist.recommendedCategory}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-1">컨디션</p>
                      <p className="text-sm font-medium text-gray-800">{result.checklist.condition}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-1">가격 설정 가이드</p>
                      <p className="text-sm text-gray-700 leading-snug">{result.checklist.priceGuide}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-1">구매 기한</p>
                      <p className="text-sm font-medium text-gray-800">{result.checklist.purchaseDeadline}</p>
                    </div>
                  </div>

                  <div className="bg-indigo-50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-medium text-indigo-700">추천 태그 키워드</p>
                      <CopyButton text={result.checklist.tags.join(" ")} label="태그 전체 복사" />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {result.checklist.tags.map((tag, i) => (
                        <button
                          key={i}
                          onClick={() => navigator.clipboard.writeText(tag)}
                          className="text-xs bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-full hover:bg-indigo-200 transition-colors font-medium"
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </Section>

              {/* 셀러 팁 */}
              <Section icon={Lightbulb} title="판매 팁" iconColor="text-yellow-700" defaultOpen={false}>
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{result.sellerTip}</p>
              </Section>
            </>
          )}
        </div>

        {/* 푸터 */}
        <div className="p-5 border-t border-gray-100 shrink-0">
          {result ? (
            <div className="flex gap-3">
              <CopyButton text={buildAllText()} label="전체 내용 복사" />
              <div className="flex-1" />
              <button
                onClick={generate}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                <RefreshCw size={13} /> 재생성
              </button>
              <a
                href="https://www.buyma.com/r/shop/item/add.html"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 transition-colors"
              >
                바이마 출품하기 <ExternalLink size={13} />
              </a>
            </div>
          ) : (
            <button onClick={onClose} className="w-full btn-secondary">닫기</button>
          )}
        </div>

      </div>
    </div>
  );
}

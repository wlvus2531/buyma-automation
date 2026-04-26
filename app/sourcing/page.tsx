"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, RefreshCw, Search, Pencil, Trash2, ShoppingBag, Image as ImageIcon } from "lucide-react";
import type { SourcingItem, SourcingStatus } from "@/lib/types";
import { formatKrw, formatJpy, formatPercent, statusBadgeClass, marginBg, generateId, calcMargin } from "@/lib/utils";
import SourcingModal from "@/components/sourcing/SourcingModal";
import BuymaListingModal from "@/components/sourcing/BuymaListingModal";
import ImageViewerModal from "@/components/sourcing/ImageViewerModal";

// ─── 썸네일 셀 (행별 이미지 자동 로드) ──────────────────────────────────────

const imageCache = new Map<string, string | null>();

function ThumbnailCell({ sourceUrl, onClick }: { sourceUrl: string; onClick: () => void }) {
  const [imgUrl, setImgUrl] = useState<string | null | "loading">(() => {
    if (!sourceUrl) return null;
    return imageCache.has(sourceUrl) ? (imageCache.get(sourceUrl) ?? null) : "loading";
  });
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    if (!sourceUrl || imageCache.has(sourceUrl)) return;

    fetch("/api/fetch-product-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: sourceUrl }),
    })
      .then((r) => r.json())
      .then((data) => {
        const url = data.mainImage ?? null;
        imageCache.set(sourceUrl, url);
        if (mounted.current) setImgUrl(url);
      })
      .catch(() => {
        imageCache.set(sourceUrl, null);
        if (mounted.current) setImgUrl(null);
      });

    return () => { mounted.current = false; };
  }, [sourceUrl]);

  if (!sourceUrl) {
    return (
      <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
        <ImageIcon size={13} className="text-gray-300" />
      </div>
    );
  }

  if (imgUrl === "loading") {
    return (
      <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
        <RefreshCw size={12} className="text-gray-300 animate-spin" />
      </div>
    );
  }

  if (!imgUrl) {
    return (
      <button
        onClick={onClick}
        title="이미지 없음 · 클릭하여 재시도"
        className="w-10 h-10 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
      >
        <ImageIcon size={13} className="text-gray-400" />
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      title="이미지 보기"
      className="w-10 h-10 rounded-lg overflow-hidden border-2 border-gray-200 hover:border-indigo-400 transition-colors shrink-0"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/proxy-image?url=${encodeURIComponent(imgUrl)}`}
        alt=""
        className="w-full h-full object-cover"
        loading="lazy"
      />
    </button>
  );
}

const STATUSES: SourcingStatus[] = ["조사중", "등록완료", "판매중", "일시정지", "중단"];

export default function SourcingPage() {
  const [items, setItems] = useState<SourcingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<SourcingStatus | "전체">("전체");
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<SourcingItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [listingItem, setListingItem] = useState<SourcingItem | null>(null);
  const [imageViewerItem, setImageViewerItem] = useState<SourcingItem | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/sheets/sourcing");
    const data = await res.json();
    setItems(data.items ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = items.filter((item) => {
    const matchSearch = item.productName.toLowerCase().includes(search.toLowerCase()) ||
      item.brand.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "전체" || item.status === statusFilter;
    return matchSearch && matchStatus;
  });

  async function handleSave(item: Partial<SourcingItem>) {
    setSaving(true);
    const calc = calcMargin({
      sellingPrice: item.sellingPrice ?? 0,
      purchasePrice: item.koreaPurchasePrice ?? 0,
      shippingCost: item.shippingCost ?? 0,
      exchangeRate: item.exchangeRate ?? 10,
      buymaFeeRate: 5.4,
      vatRefundRate: 9.09,
    });
    const now = new Date().toLocaleDateString("ko-KR");
    const toSave: SourcingItem = {
      id: editItem?.id ?? generateId(),
      productName: item.productName ?? "",
      category: item.category ?? "",
      brand: item.brand ?? "",
      koreaPurchasePrice: item.koreaPurchasePrice ?? 0,
      buymaLowestPrice: item.buymaLowestPrice ?? 0,
      sellingPrice: item.sellingPrice ?? 0,
      competitorCount: item.competitorCount ?? 0,
      status: item.status ?? "조사중",
      marginWithRefund: parseFloat(calc.marginWithRefund.toFixed(2)),
      marginWithoutRefund: parseFloat(calc.marginWithoutRefund.toFixed(2)),
      shippingCost: item.shippingCost ?? 0,
      exchangeRate: item.exchangeRate ?? 10,
      notes: item.notes ?? "",
      createdAt: editItem?.createdAt ?? now,
      sourceUrl: item.sourceUrl ?? "",
    };

    await fetch("/api/sheets/sourcing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toSave),
    });
    await load();
    setShowModal(false);
    setEditItem(null);
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("이 소싱 항목을 삭제하시겠습니까?")) return;
    await fetch(`/api/sheets/sourcing?id=${id}`, { method: "DELETE" });
    await load();
  }

  const counts = STATUSES.reduce((acc, s) => {
    acc[s] = items.filter((i) => i.status === s).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">소싱 리스트</h1>
          <p className="text-gray-500 text-sm mt-1">총 {items.length}개 상품</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="btn-secondary flex items-center gap-2">
            <RefreshCw size={15} /> 새로고침
          </button>
          <button onClick={() => { setEditItem(null); setShowModal(true); }} className="btn-primary flex items-center gap-2">
            <Plus size={15} /> 상품 추가
          </button>
        </div>
      </div>

      {/* 상태 필터 */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setStatusFilter("전체")}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${statusFilter === "전체" ? "bg-indigo-600 text-white" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"}`}
        >
          전체 ({items.length})
        </button>
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${statusFilter === s ? "bg-indigo-600 text-white" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"}`}
          >
            {s} ({counts[s] ?? 0})
          </button>
        ))}
      </div>

      {/* 검색 */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="상품명 또는 브랜드로 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input pl-9"
        />
      </div>

      {/* 테이블 */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {["상품명", "카테고리/브랜드", "한국매입가", "판매가(JPY)", "바이마최저가", "경쟁자", "마진(환급포함)", "마진(환급제외)", "상태", ""].map((h) => (
                  <th key={h} className="table-header px-4 py-3 text-left whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 10 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-gray-100 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-12 text-gray-400">
                    {search || statusFilter !== "전체" ? "검색 결과가 없습니다" : "소싱 상품을 추가해 주세요"}
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <ThumbnailCell
                          sourceUrl={item.sourceUrl ?? ""}
                          onClick={() => setImageViewerItem(item)}
                        />
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 max-w-[150px] truncate">{item.productName}</p>
                          {item.notes && <p className="text-xs text-gray-400 truncate max-w-[150px]">{item.notes}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-700">{item.category}</p>
                      <p className="text-xs text-gray-400">{item.brand}</p>
                    </td>
                    <td className="px-4 py-3 font-medium">{formatKrw(item.koreaPurchasePrice)}</td>
                    <td className="px-4 py-3 font-medium">{formatJpy(item.sellingPrice)}</td>
                    <td className="px-4 py-3">
                      {item.buymaLowestPrice > 0 ? (
                        <span className={item.sellingPrice <= item.buymaLowestPrice ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                          {formatJpy(item.buymaLowestPrice)}
                        </span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`badge ${item.competitorCount <= 3 ? "bg-green-100 text-green-700" : item.competitorCount <= 8 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>
                        {item.competitorCount}명
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${marginBg(item.marginWithRefund)}`}>
                        {formatPercent(item.marginWithRefund)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${marginBg(item.marginWithoutRefund)}`}>
                        {formatPercent(item.marginWithoutRefund)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${statusBadgeClass(item.status)}`}>{item.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setImageViewerItem(item)}
                          title="이미지 · 원스톱 등록"
                          className="p-1.5 hover:bg-blue-50 rounded-lg transition-colors text-gray-400 hover:text-blue-500"
                        >
                          <ImageIcon size={14} />
                        </button>
                        <button
                          onClick={() => setListingItem(item)}
                          title="바이마 등록 준비"
                          className="p-1.5 hover:bg-indigo-50 rounded-lg transition-colors text-gray-400 hover:text-indigo-600"
                        >
                          <ShoppingBag size={14} />
                        </button>
                        <button
                          onClick={() => { setEditItem(item); setShowModal(true); }}
                          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-600"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="p-1.5 hover:bg-red-50 rounded-lg transition-colors text-gray-400 hover:text-red-500"
                        >
                          <Trash2 size={14} />
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
        <SourcingModal
          item={editItem}
          onClose={() => { setShowModal(false); setEditItem(null); }}
          onSave={handleSave}
          saving={saving}
        />
      )}

      {listingItem && (
        <BuymaListingModal
          item={listingItem}
          onClose={() => setListingItem(null)}
        />
      )}

      {imageViewerItem && (
        <ImageViewerModal
          item={imageViewerItem}
          onClose={() => setImageViewerItem(null)}
          onBuymaListing={() => {
            setListingItem(imageViewerItem);
            setImageViewerItem(null);
          }}
        />
      )}
    </div>
  );
}

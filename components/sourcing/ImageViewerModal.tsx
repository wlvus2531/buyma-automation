"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  X, ChevronLeft, ChevronRight, Download, Image as ImageIcon,
  Palette, ShoppingBag, RefreshCw, AlertCircle, ExternalLink,
} from "lucide-react";
import type { SourcingItem } from "@/lib/types";
import clsx from "clsx";

interface Props {
  item: SourcingItem;
  onClose: () => void;
  onBuymaListing: () => void;
}

function proxyUrl(src: string) {
  return `/api/proxy-image?url=${encodeURIComponent(src)}`;
}

export default function ImageViewerModal({ item, onClose, onBuymaListing }: Props) {
  const router = useRouter();
  const [images, setImages] = useState<string[]>([]);
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [manualUrl, setManualUrl] = useState(item.sourceUrl ?? "");
  const [imgError, setImgError] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const fetchingRef = useRef(false);

  const fetchImages = useCallback(async (url: string) => {
    if (!url || fetchingRef.current) return;
    fetchingRef.current = true;
    setLoading(true);
    setError("");
    setImages([]);
    setCurrent(0);
    setImgError(false);

    try {
      const res = await fetch("/api/fetch-product-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();

      if (data.images && data.images.length > 0) {
        setImages(data.images);
      } else {
        setError(data.error ?? "이미지를 찾을 수 없습니다.");
      }
    } catch {
      setError("이미지 가져오기에 실패했습니다.");
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (item.sourceUrl) fetchImages(item.sourceUrl);
    else setLoading(false);
  }, [item.sourceUrl, fetchImages]);

  function prev() { setCurrent((c) => (c - 1 + images.length) % images.length); setImgError(false); }
  function next() { setCurrent((c) => (c + 1) % images.length); setImgError(false); }

  async function handleDownload() {
    if (!images[current]) return;
    setDownloading(true);
    try {
      const res = await fetch(proxyUrl(images[current]));
      const blob = await res.blob();
      const ext = blob.type.split("/")[1] ?? "jpg";
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${item.brand || "product"}-${Date.now()}.${ext}`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch { /* ignore */ }
    finally { setDownloading(false); }
  }

  function handleGoThumbnail() {
    if (!images[current]) return;
    sessionStorage.setItem("thumbnail_image_url", images[current]);
    sessionStorage.setItem("thumbnail_brand", item.brand ?? "");
    sessionStorage.setItem("thumbnail_product", item.productName ?? "");
    sessionStorage.setItem("thumbnail_price", String(item.sellingPrice || ""));
    router.push("/thumbnail");
    onClose();
  }

  // 키보드 화살표 지원
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const currentImg = images[current];

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] flex flex-col">

        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
              <ImageIcon size={15} className="text-blue-600" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 text-sm truncate max-w-xs">{item.productName}</p>
              {item.brand && <p className="text-xs text-gray-400">{item.brand}</p>}
            </div>
            {images.length > 0 && (
              <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium shrink-0">
                {images.length}장
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors shrink-0">
            <X size={17} />
          </button>
        </div>

        {/* 메인 뷰어 */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          {loading && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-400">
              <RefreshCw size={28} className="animate-spin" />
              <p className="text-sm">이미지 가져오는 중...</p>
            </div>
          )}

          {!loading && error && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
              <div className="w-14 h-14 bg-orange-50 rounded-2xl flex items-center justify-center">
                <AlertCircle size={24} className="text-orange-400" />
              </div>
              <div className="text-center">
                <p className="text-gray-600 text-sm font-medium">{error}</p>
                <p className="text-gray-400 text-xs mt-1">URL을 직접 입력하거나 이미지 URL을 붙여넣어 보세요</p>
              </div>
              <div className="w-full max-w-sm space-y-2">
                <div className="flex gap-2">
                  <input
                    value={manualUrl}
                    onChange={(e) => setManualUrl(e.target.value)}
                    placeholder="상품 URL 또는 이미지 URL 입력"
                    className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    onKeyDown={(e) => e.key === "Enter" && fetchImages(manualUrl)}
                  />
                  <button
                    onClick={() => {
                      if (manualUrl.match(/\.(jpg|jpeg|png|webp|gif)/i)) {
                        setImages([manualUrl]);
                        setError("");
                      } else {
                        fetchImages(manualUrl);
                      }
                    }}
                    className="px-3 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    이동
                  </button>
                </div>
              </div>
            </div>
          )}

          {!loading && !error && images.length === 0 && !item.sourceUrl && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
              <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center">
                <ImageIcon size={24} className="text-gray-300" />
              </div>
              <p className="text-gray-400 text-sm">구매처 URL이 없습니다</p>
              <div className="w-full max-w-sm flex gap-2">
                <input
                  value={manualUrl}
                  onChange={(e) => setManualUrl(e.target.value)}
                  placeholder="무신사/29cm/EQL URL 입력"
                  className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  onKeyDown={(e) => e.key === "Enter" && fetchImages(manualUrl)}
                />
                <button
                  onClick={() => fetchImages(manualUrl)}
                  className="px-3 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  가져오기
                </button>
              </div>
            </div>
          )}

          {!loading && images.length > 0 && (
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              {/* 메인 이미지 */}
              <div className="relative flex-1 flex items-center justify-center bg-gray-50 overflow-hidden min-h-0">
                {imgError ? (
                  <div className="flex flex-col items-center gap-2 text-gray-300">
                    <ImageIcon size={36} />
                    <p className="text-sm">이미지를 불러올 수 없습니다</p>
                  </div>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={currentImg}
                    src={proxyUrl(currentImg)}
                    alt={`상품 이미지 ${current + 1}`}
                    className="max-h-full max-w-full object-contain"
                    onError={() => setImgError(true)}
                    draggable={false}
                  />
                )}

                {images.length > 1 && (
                  <>
                    <button
                      onClick={prev}
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/90 shadow-md rounded-full flex items-center justify-center hover:bg-white transition-colors"
                    >
                      <ChevronLeft size={18} className="text-gray-700" />
                    </button>
                    <button
                      onClick={next}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/90 shadow-md rounded-full flex items-center justify-center hover:bg-white transition-colors"
                    >
                      <ChevronRight size={18} className="text-gray-700" />
                    </button>
                  </>
                )}

                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/50 text-white text-xs px-2.5 py-1 rounded-full">
                  {current + 1} / {images.length}
                </div>
              </div>

              {/* 썸네일 스트립 */}
              {images.length > 1 && (
                <div className="shrink-0 flex gap-2 overflow-x-auto p-3 border-t border-gray-100 bg-white">
                  {images.map((img, i) => (
                    <button
                      key={i}
                      onClick={() => { setCurrent(i); setImgError(false); }}
                      className={clsx(
                        "shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all",
                        i === current ? "border-indigo-500" : "border-gray-200 hover:border-gray-400"
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={proxyUrl(img)} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 원스톱 플로우 푸터 */}
        <div className="px-5 py-4 border-t border-gray-100 shrink-0">
          <div className="flex items-center gap-2">
            {/* 다운로드 */}
            <button
              onClick={handleDownload}
              disabled={!currentImg || downloading}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl disabled:opacity-40 transition-colors"
            >
              {downloading ? <RefreshCw size={13} className="animate-spin" /> : <Download size={13} />}
              다운로드
            </button>

            <div className="flex-1" />

            {/* 썸네일 생성 */}
            <button
              onClick={handleGoThumbnail}
              disabled={!currentImg}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-orange-700 bg-orange-50 border border-orange-200 hover:bg-orange-100 rounded-xl disabled:opacity-40 transition-colors"
            >
              <Palette size={14} />
              썸네일 생성
              <ExternalLink size={11} className="opacity-60" />
            </button>

            {/* 바이마 등록 준비 */}
            <button
              onClick={() => { onBuymaListing(); onClose(); }}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors"
            >
              <ShoppingBag size={14} />
              바이마 등록 준비
            </button>
          </div>

          {/* 원스톱 플로우 안내 */}
          <div className="mt-2.5 flex items-center gap-1.5 text-xs text-gray-400">
            <span className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-500 font-medium">1</span>
            <span>이미지 확인</span>
            <ChevronRight size={10} />
            <span className="bg-orange-100 px-1.5 py-0.5 rounded text-orange-600 font-medium">2</span>
            <span>썸네일 생성</span>
            <ChevronRight size={10} />
            <span className="bg-indigo-100 px-1.5 py-0.5 rounded text-indigo-600 font-medium">3</span>
            <span>바이마 등록 준비</span>
          </div>
        </div>

      </div>
    </div>
  );
}

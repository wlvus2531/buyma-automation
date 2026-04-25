"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Image as ImageIcon, Download, RefreshCw, Type, Palette } from "lucide-react";

const CANVAS_SIZE = 500;

const TEMPLATES = [
  { id: "clean", label: "심플 화이트", bg: "#FFFFFF", textColor: "#1a1a1a", accent: "#FF385C" },
  { id: "dark", label: "다크 럭셔리", bg: "#1a1a1a", textColor: "#FFFFFF", accent: "#FFD700" },
  { id: "pink", label: "핑크 감성", bg: "#FFF0F3", textColor: "#1a1a1a", accent: "#FF6B8A" },
  { id: "beige", label: "베이지 내추럴", bg: "#F5F0E8", textColor: "#3d3025", accent: "#8B6914" },
  { id: "navy", label: "네이비 프리미엄", bg: "#0D1B2A", textColor: "#FFFFFF", accent: "#4A90D9" },
];

export default function ThumbnailPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [template, setTemplate] = useState(TEMPLATES[0]);
  const [brandName, setBrandName] = useState("");
  const [productName, setProductName] = useState("");
  const [price, setPrice] = useState("");
  const [subText, setSubText] = useState("日本未入荷");
  const [showBadge, setShowBadge] = useState(true);
  const [imagePos, setImagePos] = useState({ x: 0, y: 0, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 배경
    ctx.fillStyle = template.bg;
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // 이미지
    if (image) {
      ctx.save();
      const scale = imagePos.scale;
      const iw = image.width * scale;
      const ih = image.height * scale;
      const x = CANVAS_SIZE / 2 - iw / 2 + imagePos.x;
      const y = CANVAS_SIZE / 2 - ih / 2 + imagePos.y;
      ctx.drawImage(image, x, y, iw, ih);
      ctx.restore();
    }

    // 하단 그라데이션 오버레이
    if (brandName || productName || price) {
      const grad = ctx.createLinearGradient(0, CANVAS_SIZE - 160, 0, CANVAS_SIZE);
      grad.addColorStop(0, "rgba(0,0,0,0)");
      grad.addColorStop(1, template.bg === "#FFFFFF" || template.bg === "#F5F0E8" || template.bg === "#FFF0F3"
        ? "rgba(255,255,255,0.95)" : "rgba(0,0,0,0.85)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, CANVAS_SIZE - 160, CANVAS_SIZE, 160);
    }

    // 브랜드명
    if (brandName) {
      ctx.font = "bold 16px 'Helvetica Neue', Arial, sans-serif";
      ctx.fillStyle = template.accent;
      ctx.textAlign = "center";
      ctx.letterSpacing = "3px";
      ctx.fillText(brandName.toUpperCase(), CANVAS_SIZE / 2, CANVAS_SIZE - 100);
    }

    // 상품명
    if (productName) {
      ctx.font = `bold ${productName.length > 16 ? "17" : "20"}px 'Helvetica Neue', Arial, sans-serif`;
      ctx.fillStyle = template.textColor;
      ctx.textAlign = "center";
      ctx.letterSpacing = "0px";
      // 줄바꿈 처리
      const words = productName.split(" ");
      let line = "";
      let y = CANVAS_SIZE - 65;
      for (const word of words) {
        const test = line ? `${line} ${word}` : word;
        if (ctx.measureText(test).width > 440) {
          ctx.fillText(line, CANVAS_SIZE / 2, y);
          line = word;
          y += 24;
        } else {
          line = test;
        }
      }
      ctx.fillText(line, CANVAS_SIZE / 2, y);
    }

    // 가격
    if (price) {
      ctx.font = "bold 22px 'Helvetica Neue', Arial, sans-serif";
      ctx.fillStyle = template.accent;
      ctx.textAlign = "center";
      ctx.fillText(`¥${price}`, CANVAS_SIZE / 2, CANVAS_SIZE - 18);
    }

    // BUYMA 뱃지
    if (showBadge) {
      ctx.fillStyle = template.accent;
      ctx.beginPath();
      ctx.roundRect(12, 12, 90, 28, 14);
      ctx.fill();
      ctx.font = "bold 12px 'Helvetica Neue', Arial, sans-serif";
      ctx.fillStyle = "#FFFFFF";
      ctx.textAlign = "center";
      ctx.fillText("BUYMA限定", 57, 30);
    }

    // 서브텍스트 뱃지
    if (subText) {
      ctx.fillStyle = template.bg === "#1a1a1a" || template.bg === "#0D1B2A"
        ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.07)";
      ctx.beginPath();
      ctx.roundRect(CANVAS_SIZE - 12 - 90, 12, 90, 28, 14);
      ctx.fill();
      ctx.font = "bold 11px 'Helvetica Neue', Arial, sans-serif";
      ctx.fillStyle = template.textColor;
      ctx.textAlign = "center";
      ctx.fillText(subText, CANVAS_SIZE - 12 - 45, 30);
    }
  }, [image, template, brandName, productName, price, subText, showBadge, imagePos]);

  useEffect(() => { draw(); }, [draw]);

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(CANVAS_SIZE / img.width, CANVAS_SIZE / img.height) * 0.85;
        setImagePos({ x: 0, y: -20, scale });
        setImage(img);
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!image) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - imagePos.x, y: e.clientY - imagePos.y });
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!isDragging) return;
    setImagePos((prev) => ({ ...prev, x: e.clientX - dragStart.x, y: e.clientY - dragStart.y }));
  }

  function handleWheel(e: React.WheelEvent<HTMLCanvasElement>) {
    e.preventDefault();
    setImagePos((prev) => ({ ...prev, scale: Math.max(0.1, prev.scale - e.deltaY * 0.001) }));
  }

  function handleDownload() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `buyma-thumbnail-${Date.now()}.jpg`;
    link.href = canvas.toDataURL("image/jpeg", 0.95);
    link.click();
  }

  function handleReset() {
    if (!image) return;
    const scale = Math.min(CANVAS_SIZE / image.width, CANVAS_SIZE / image.height) * 0.85;
    setImagePos({ x: 0, y: -20, scale });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
          <ImageIcon size={20} className="text-orange-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">썸네일 생성기</h1>
          <p className="text-gray-500 text-sm">바이마 판매용 500×500px 썸네일을 만들어 보세요</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 설정 패널 */}
        <div className="space-y-4">
          {/* 이미지 업로드 */}
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <ImageIcon size={16} /> 상품 이미지
            </h3>
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-xl py-8 cursor-pointer hover:border-indigo-300 hover:bg-indigo-50 transition-colors">
              <ImageIcon size={32} className="text-gray-300 mb-2" />
              <span className="text-sm text-gray-500">이미지 클릭하여 업로드</span>
              <span className="text-xs text-gray-400 mt-1">JPG, PNG, WEBP</span>
              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            </label>
            {image && (
              <p className="text-xs text-green-600 mt-2 text-center">
                ✓ 이미지 로드됨 · 캔버스에서 드래그로 위치 조정, 스크롤로 크기 조정
              </p>
            )}
          </div>

          {/* 템플릿 */}
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Palette size={16} /> 디자인 템플릿
            </h3>
            <div className="grid grid-cols-5 gap-2">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTemplate(t)}
                  className={`flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all ${template.id === t.id ? "border-indigo-500" : "border-gray-100 hover:border-gray-300"}`}
                >
                  <div className="w-8 h-8 rounded-lg border border-gray-200" style={{ background: t.bg }} />
                  <span className="text-xs text-gray-600 text-center leading-tight">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 텍스트 */}
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Type size={16} /> 텍스트 정보
            </h3>
            <div className="space-y-3">
              <div>
                <label className="label">브랜드명</label>
                <input className="input" value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="예: AESTURA" />
              </div>
              <div>
                <label className="label">상품명</label>
                <input className="input" value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="예: 아토베리어 365 크림" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">판매가 (JPY, 선택)</label>
                  <input className="input" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="예: 3,800" />
                </div>
                <div>
                  <label className="label">서브 뱃지 텍스트</label>
                  <input className="input" value={subText} onChange={(e) => setSubText(e.target.value)} placeholder="日本未入荷" />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={showBadge} onChange={(e) => setShowBadge(e.target.checked)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                <span className="text-sm text-gray-700">BUYMA限定 뱃지 표시</span>
              </label>
            </div>
          </div>
        </div>

        {/* 캔버스 프리뷰 */}
        <div className="space-y-3">
          <div className="card p-3">
            <canvas
              ref={canvasRef}
              width={CANVAS_SIZE}
              height={CANVAS_SIZE}
              className="w-full rounded-xl cursor-move border border-gray-100"
              style={{ maxWidth: CANVAS_SIZE, aspectRatio: "1" }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={() => setIsDragging(false)}
              onMouseLeave={() => setIsDragging(false)}
              onWheel={handleWheel}
            />
          </div>
          <div className="flex gap-2">
            <button onClick={handleReset} className="btn-secondary flex items-center gap-2 flex-1">
              <RefreshCw size={15} /> 이미지 위치 초기화
            </button>
            <button onClick={handleDownload} className="btn-primary flex items-center gap-2 flex-1">
              <Download size={15} /> JPG 다운로드
            </button>
          </div>
          <p className="text-xs text-gray-400 text-center">500×500px · JPEG 95% 품질 · 바이마 업로드 최적화</p>
        </div>
      </div>
    </div>
  );
}

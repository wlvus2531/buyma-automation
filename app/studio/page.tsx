"use client";

/**
 * 썸네일 제작 스튜디오 — v4 P4b
 *
 * 원칙(강의자료):
 * - 썸네일은 타 셀러 창작물 사용 절대 금지 → 직접 제작
 * - 모델 얼굴이 나오면 절대 안 됨 → 다운로드 전 확인 체크 필수 + 상하 포커스로 얼굴 제외
 * - 대량 등록 시 일관성 유지 → 고정 템플릿 프레임
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { Download, Check, AlertTriangle, RefreshCw, ImageOff } from "lucide-react";

interface Product {
  id: string;
  name_kr: string;
  brand: string | null;
  list_price_jpy: number | null;
  thumbnail_url: string | null;
  source_url: string | null;
}

const CANVAS = 1080; // 정사각 1080px

type TemplateId = "clean" | "band" | "frame";
const TEMPLATES: { id: TemplateId; label: string }[] = [
  { id: "clean", label: "클린" },
  { id: "band", label: "하단바" },
  { id: "frame", label: "프레임" },
];

const BADGES = ["韓国発", "★関税込★", "★日本未入荷★", "★大人気★", "없음"];

export default function StudioPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState<Product | null>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [imgErr, setImgErr] = useState(false);

  const [template, setTemplate] = useState<TemplateId>("band");
  const [focus, setFocus] = useState(0.5); // 0=위, 1=아래 (얼굴이 위에 있으면 아래로)
  const [zoom, setZoom] = useState(1);
  const [badge, setBadge] = useState("韓国発");
  const [brandText, setBrandText] = useState("");
  const [faceChecked, setFaceChecked] = useState(false);
  const [savedMark, setSavedMark] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 상품 목록 로드 (썸네일 원본 있는 것)
  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await fetch("/api/products");
      const data = await res.json();
      const list: Product[] = (data.products ?? []).filter((p: Product) => p.thumbnail_url);
      setProducts(list);
      setLoading(false);
      if (list[0]) selectProduct(list[0]);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectProduct = useCallback((p: Product) => {
    setSel(p);
    setBrandText(p.brand ?? "");
    setFaceChecked(false);
    setSavedMark(false);
    setImg(null);
    setImgErr(false);
    setFocus(0.5);
    setZoom(1);
    if (!p.thumbnail_url) return;
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => setImg(image);
    image.onerror = () => setImgErr(true);
    image.src = `/api/proxy-image?url=${encodeURIComponent(p.thumbnail_url)}`;
  }, []);

  // 캔버스 렌더
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 배경
    ctx.clearRect(0, 0, CANVAS, CANVAS);
    if (template === "band" || template === "clean") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, CANVAS, CANVAS);
    } else {
      // frame: 은은한 그라디언트
      const g = ctx.createLinearGradient(0, 0, 0, CANVAS);
      g.addColorStop(0, "#fafaf9");
      g.addColorStop(1, "#f0eeec");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, CANVAS, CANVAS);
    }

    if (!img) {
      ctx.fillStyle = "#d6d3d1";
      ctx.font = "600 40px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(imgErr ? "이미지 로드 실패" : "이미지 없음", CANVAS / 2, CANVAS / 2);
      return;
    }

    // 이미지 영역 (템플릿별 패딩)
    const pad = template === "frame" ? 90 : template === "band" ? 40 : 20;
    const areaTop = pad;
    const areaH = template === "band" ? CANVAS - pad - 150 : CANVAS - pad * 2;
    const areaW = CANVAS - pad * 2;
    const areaLeft = pad;

    // cover fit + zoom + 세로 focus (얼굴 회피)
    const scale = Math.max(areaW / img.width, areaH / img.height) * zoom;
    const dw = img.width * scale;
    const dh = img.height * scale;
    const dx = areaLeft + (areaW - dw) / 2;
    const dy = areaTop + (areaH - dh) * focus;

    ctx.save();
    ctx.beginPath();
    const r = template === "frame" ? 24 : 12;
    roundRect(ctx, areaLeft, areaTop, areaW, areaH, r);
    ctx.clip();
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.restore();

    // frame: 테두리
    if (template === "frame") {
      ctx.strokeStyle = "#e7e5e4";
      ctx.lineWidth = 3;
      roundRect(ctx, areaLeft, areaTop, areaW, areaH, r);
      ctx.stroke();
    }

    // 하단 브랜드 바 (band)
    if (template === "band") {
      ctx.fillStyle = "#1c1917";
      ctx.fillRect(0, CANVAS - 110, CANVAS, 110);
      ctx.fillStyle = "#ffffff";
      ctx.font = "700 46px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(brandText || "BRAND", 44, CANVAS - 44);
      if (sel?.list_price_jpy) {
        ctx.textAlign = "right";
        ctx.font = "600 40px sans-serif";
        ctx.fillStyle = "#a8f0c6";
        ctx.fillText(`¥${sel.list_price_jpy.toLocaleString()}`, CANVAS - 44, CANVAS - 44);
      }
    } else {
      // clean/frame: 브랜드 텍스트 하단 중앙
      ctx.fillStyle = "#1c1917";
      ctx.font = "700 44px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(brandText || "BRAND", CANVAS / 2, CANVAS - 40);
    }

    // 배지 (좌상단 리본)
    if (badge && badge !== "없음") {
      ctx.font = "700 34px sans-serif";
      const bw = ctx.measureText(badge).width + 44;
      ctx.fillStyle = "#dc2626";
      roundRect(ctx, 40, 40, bw, 60, 10);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.fillText(badge, 40 + bw / 2, 82);
    }
  }, [img, imgErr, template, focus, zoom, badge, brandText, sel]);

  const download = () => {
    const canvas = canvasRef.current;
    if (!canvas || !sel) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `thumb_${(sel.brand ?? "item").replace(/\s+/g, "")}_${sel.id.slice(0, 6)}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }, "image/jpeg", 0.9);
  };

  const saveToProduct = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !sel) return;
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    const res = await fetch("/api/products/thumbnail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: sel.id, thumbnail_made_url: dataUrl }),
    });
    if (res.ok) setSavedMark(true);
  };

  return (
    <div className="min-h-screen bg-stone-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-5">
          <h1 className="text-xl font-bold text-stone-900">🎨 썸네일 제작 스튜디오</h1>
          <p className="text-sm text-stone-500 mt-1">
            타 셀러 이미지 사용 금지 · 직접 제작 · <b className="text-rose-600">모델 얼굴 없는 컷</b>으로 제작하세요
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr_260px] gap-4">
          {/* 상품 목록 */}
          <div className="bg-white rounded-2xl ring-1 ring-stone-200 p-2 h-[600px] overflow-y-auto">
            {loading ? (
              <p className="text-sm text-stone-400 p-3">불러오는 중...</p>
            ) : products.length === 0 ? (
              <p className="text-sm text-stone-400 p-3">원본 썸네일이 있는 상품이 없습니다</p>
            ) : (
              products.map((p) => (
                <button
                  key={p.id}
                  onClick={() => selectProduct(p)}
                  className={`w-full flex items-center gap-2 p-2 rounded-xl text-left transition ${
                    sel?.id === p.id ? "bg-stone-900 text-white" : "hover:bg-stone-100"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/proxy-image?url=${encodeURIComponent(p.thumbnail_url ?? "")}`}
                    alt="" className="w-10 h-10 rounded-lg object-cover bg-stone-100 shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold truncate">{p.brand ?? "노브랜드"}</p>
                    <p className={`text-[10px] truncate ${sel?.id === p.id ? "text-stone-300" : "text-stone-400"}`}>
                      {p.name_kr}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* 캔버스 */}
          <div className="bg-white rounded-2xl ring-1 ring-stone-200 p-4 flex items-center justify-center">
            <canvas
              ref={canvasRef}
              width={CANVAS}
              height={CANVAS}
              className="w-full max-w-[520px] aspect-square rounded-xl ring-1 ring-stone-100 shadow-sm"
            />
          </div>

          {/* 컨트롤 */}
          <div className="bg-white rounded-2xl ring-1 ring-stone-200 p-4 space-y-4">
            <Control label="템플릿">
              <div className="flex gap-1.5">
                {TEMPLATES.map((t) => (
                  <button key={t.id} onClick={() => setTemplate(t.id)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold ${template === t.id ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-500"}`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </Control>

            <Control label="배지">
              <div className="flex flex-wrap gap-1">
                {BADGES.map((b) => (
                  <button key={b} onClick={() => setBadge(b)}
                    className={`px-2 py-1 rounded-md text-[11px] font-medium ${badge === b ? "bg-rose-600 text-white" : "bg-stone-100 text-stone-500"}`}>
                    {b}
                  </button>
                ))}
              </div>
            </Control>

            <Control label="브랜드 표기">
              <input value={brandText} onChange={(e) => setBrandText(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg ring-1 ring-stone-200 text-sm focus:outline-none focus:ring-stone-400" />
            </Control>

            <Control label={`세로 위치 (얼굴 회피) — ${focus < 0.35 ? "위쪽" : focus > 0.65 ? "아래쪽" : "중앙"}`}>
              <input type="range" min={0} max={1} step={0.05} value={focus}
                onChange={(e) => setFocus(+e.target.value)} className="w-full accent-stone-900" />
            </Control>

            <Control label={`확대 ${zoom.toFixed(2)}x`}>
              <input type="range" min={1} max={2} step={0.05} value={zoom}
                onChange={(e) => setZoom(+e.target.value)} className="w-full accent-stone-900" />
            </Control>

            {/* 얼굴 확인 */}
            <label className={`flex items-start gap-2 p-2.5 rounded-xl cursor-pointer ${faceChecked ? "bg-emerald-50 ring-1 ring-emerald-200" : "bg-amber-50 ring-1 ring-amber-200"}`}>
              <input type="checkbox" checked={faceChecked} onChange={(e) => setFaceChecked(e.target.checked)} className="mt-0.5 accent-emerald-600" />
              <span className="text-[11px] leading-tight text-stone-700">
                {faceChecked ? <Check className="inline w-3 h-3 text-emerald-600" /> : <AlertTriangle className="inline w-3 h-3 text-amber-500" />}
                {" "}이 이미지에 <b>모델 얼굴이 없음</b>을 확인했습니다
              </span>
            </label>

            <div className="space-y-2 pt-1">
              <button onClick={download} disabled={!faceChecked || !img}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-stone-900 text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed">
                <Download className="w-4 h-4" /> 다운로드
              </button>
              <button onClick={saveToProduct} disabled={!faceChecked || !img}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-stone-100 text-stone-700 text-xs font-semibold disabled:opacity-40">
                {savedMark ? <><Check className="w-3.5 h-3.5 text-emerald-600" /> 저장됨</> : <>상품에 저장</>}
              </button>
            </div>

            {sel?.source_url && (
              <a href={sel.source_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-1 text-[11px] text-sky-600 hover:underline pt-1">
                <RefreshCw className="w-3 h-3" /> 원본 상품에서 다른 컷 찾기
              </a>
            )}
            {imgErr && (
              <p className="flex items-center gap-1 text-[11px] text-rose-500"><ImageOff className="w-3 h-3" /> 원본 이미지를 불러오지 못했습니다</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Control({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-stone-500 mb-1.5">{label}</p>
      {children}
    </div>
  );
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

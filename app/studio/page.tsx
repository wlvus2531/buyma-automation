"use client";

/**
 * 썸네일 제작 스튜디오 v2 — v4 P4b
 *
 * 원칙(강의자료):
 * - 썸네일은 타 셀러 창작물 사용 절대 금지 → 직접 제작
 * - 모델 얼굴 금지 → 세로 포커스로 얼굴 제외 + 사람 최종 확인 체크
 * - 대량 등록 일관성 → 고정 템플릿
 *
 * v2 개선:
 * - 바이마 CDN org.jpg 원본 해상도 사용 (210px → 원본)
 * - 톱셀러 스타일 템플릿 3종 (화이트 스튜디오 / 크림 에디토리얼 / 페이드)
 * - 세리프 웹폰트(Marcellus) + Noto Sans JP 로드 후 렌더
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { Marcellus, Noto_Sans_JP } from "next/font/google";
import { Download, Check, AlertTriangle, RefreshCw, ImageOff } from "lucide-react";

const serifFont = Marcellus({ weight: "400", subsets: ["latin"] });
const jpFont = Noto_Sans_JP({ weight: ["500", "700"], subsets: ["latin"] });

interface Product {
  id: string;
  name_kr: string;
  brand: string | null;
  list_price_jpy: number | null;
  thumbnail_url: string | null;
  source_url: string | null;
}

const CANVAS = 1080;

type TemplateId = "white" | "cream" | "fade";
const TEMPLATES: { id: TemplateId; label: string; desc: string }[] = [
  { id: "white", label: "화이트", desc: "순백 배경 · 미니멀" },
  { id: "cream", label: "크림", desc: "따뜻한 톤 · 카드형" },
  { id: "fade", label: "페이드", desc: "풀블리드 · 하단 페이드" },
];

const BADGES = ["韓国発", "関税込", "日本未入荷", "早期完売", "없음"];

/** 바이마 CDN 리사이즈(210px 등) → 원본(org) 해상도로 승격 */
function hiResUrl(url: string): string {
  if (/cdn-images\.buyma\.com\/.+\/\d+\.jpe?g/i.test(url)) {
    return url.replace(/\/\d+\.(jpe?g)(\?.*)?$/i, "/org.$1");
  }
  return url;
}

export default function StudioPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState<Product | null>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [imgErr, setImgErr] = useState(false);
  const [fontsReady, setFontsReady] = useState(false);

  const [template, setTemplate] = useState<TemplateId>("white");
  const [focus, setFocus] = useState(0.35);
  const [zoom, setZoom] = useState(1);
  const [badge, setBadge] = useState("関税込");
  const [brandText, setBrandText] = useState("");
  const [showPrice, setShowPrice] = useState(false);
  const [faceChecked, setFaceChecked] = useState(false);
  const [savedMark, setSavedMark] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const serifProbe = useRef<HTMLSpanElement>(null);
  const jpProbe = useRef<HTMLSpanElement>(null);
  const [serifFamily, setSerifFamily] = useState("Georgia");
  const [jpFamily, setJpFamily] = useState("sans-serif");

  // next/font가 생성한 실제 font-family 이름을 DOM에서 읽어 캔버스에 사용
  useEffect(() => {
    const read = () => {
      if (serifProbe.current) setSerifFamily(getComputedStyle(serifProbe.current).fontFamily);
      if (jpProbe.current) setJpFamily(getComputedStyle(jpProbe.current).fontFamily);
      setFontsReady(true);
    };
    if (document.fonts?.ready) document.fonts.ready.then(read);
    else setTimeout(read, 800);
  }, []);

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
    setBrandText((p.brand ?? "").toUpperCase());
    setFaceChecked(false);
    setSavedMark(false);
    setImg(null);
    setImgErr(false);
    setFocus(0.35);
    setZoom(1);
    if (!p.thumbnail_url) return;

    const tryLoad = (url: string, isFallback = false) => {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.onload = () => setImg(image);
      image.onerror = () => {
        if (!isFallback) tryLoad(`/api/proxy-image?url=${encodeURIComponent(p.thumbnail_url!)}`, true);
        else setImgErr(true);
      };
      image.src = url;
    };
    // 1차: org 원본 (프록시 경유), 2차: 원래 URL
    tryLoad(`/api/proxy-image?url=${encodeURIComponent(hiResUrl(p.thumbnail_url))}`);
  }, []);

  // ── 캔버스 렌더 ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const serif = (px: number) => `400 ${px}px ${serifFamily}`;
    const jp = (px: number, w = 700) => `${w} ${px}px ${jpFamily}`;

    ctx.clearRect(0, 0, CANVAS, CANVAS);

    // ===== 배경 =====
    if (template === "cream") {
      const g = ctx.createLinearGradient(0, 0, CANVAS, CANVAS);
      g.addColorStop(0, "#faf6f0");
      g.addColorStop(1, "#efe7db");
      ctx.fillStyle = g;
    } else {
      ctx.fillStyle = "#ffffff";
    }
    ctx.fillRect(0, 0, CANVAS, CANVAS);

    if (!img) {
      ctx.fillStyle = "#d6d3d1";
      ctx.font = jp(38, 500);
      ctx.textAlign = "center";
      ctx.fillText(imgErr ? "이미지 로드 실패" : "이미지 로딩 중…", CANVAS / 2, CANVAS / 2);
      return;
    }

    // ===== 이미지 영역 =====
    let ax = 0, ay = 0, aw = CANVAS, ah = CANVAS, radius = 0;
    if (template === "white") {
      ax = 70; ay = 96; aw = CANVAS - 140; ah = CANVAS - 250; radius = 8;
    } else if (template === "cream") {
      ax = 90; ay = 110; aw = CANVAS - 180; ah = CANVAS - 290; radius = 28;
    } else {
      ax = 0; ay = 0; aw = CANVAS; ah = CANVAS; radius = 0; // fade: 풀블리드
    }

    // 카드 그림자 (white/cream)
    if (template !== "fade") {
      ctx.save();
      ctx.shadowColor = "rgba(28,25,23,0.18)";
      ctx.shadowBlur = 46;
      ctx.shadowOffsetY = 18;
      ctx.fillStyle = "#ffffff";
      roundRect(ctx, ax, ay, aw, ah, radius);
      ctx.fill();
      ctx.restore();
    }

    // cover fit + zoom + 세로 focus
    const scale = Math.max(aw / img.width, ah / img.height) * zoom;
    const dw = img.width * scale;
    const dh = img.height * scale;
    const dx = ax + (aw - dw) / 2;
    const dy = ay + (ah - dh) * focus;

    ctx.save();
    roundRect(ctx, ax, ay, aw, ah, radius);
    ctx.clip();
    // 고품질 스케일링
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.restore();

    // ===== 템플릿별 타이포 =====
    if (template === "white") {
      // 하단: 세리프 브랜드 + 얇은 구분선
      ctx.fillStyle = "#1c1917";
      ctx.font = serif(58);
      ctx.textAlign = "center";
      ctx.fillText(brandText || "BRAND", CANVAS / 2, CANVAS - 64);
      ctx.strokeStyle = "#d6d3d1";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(CANVAS / 2 - 60, CANVAS - 120);
      ctx.lineTo(CANVAS / 2 + 60, CANVAS - 120);
      ctx.stroke();
      if (showPrice && sel?.list_price_jpy) {
        ctx.font = jp(26, 500);
        ctx.fillStyle = "#78716c";
        ctx.fillText(`¥${sel.list_price_jpy.toLocaleString()}`, CANVAS / 2, CANVAS - 24);
      }
    } else if (template === "cream") {
      ctx.fillStyle = "#44403c";
      ctx.font = serif(54);
      ctx.textAlign = "center";
      ctx.fillText(brandText || "BRAND", CANVAS / 2, CANVAS - 72);
      // 금색 포인트 라인
      ctx.strokeStyle = "#c8a45c";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(CANVAS / 2 - 46, CANVAS - 128);
      ctx.lineTo(CANVAS / 2 + 46, CANVAS - 128);
      ctx.stroke();
      if (showPrice && sel?.list_price_jpy) {
        ctx.font = jp(25, 500);
        ctx.fillStyle = "#a8a29e";
        ctx.fillText(`¥${sel.list_price_jpy.toLocaleString()}`, CANVAS / 2, CANVAS - 28);
      }
    } else {
      // fade: 하단 화이트 그라디언트 위 세리프 브랜드
      const g = ctx.createLinearGradient(0, CANVAS - 320, 0, CANVAS);
      g.addColorStop(0, "rgba(255,255,255,0)");
      g.addColorStop(0.55, "rgba(255,255,255,0.88)");
      g.addColorStop(1, "rgba(255,255,255,0.97)");
      ctx.fillStyle = g;
      ctx.fillRect(0, CANVAS - 320, CANVAS, 320);

      ctx.fillStyle = "#1c1917";
      ctx.font = serif(64);
      ctx.textAlign = "center";
      ctx.fillText(brandText || "BRAND", CANVAS / 2, CANVAS - 96);
      if (showPrice && sel?.list_price_jpy) {
        ctx.font = jp(27, 500);
        ctx.fillStyle = "#57534e";
        ctx.fillText(`¥${sel.list_price_jpy.toLocaleString()}`, CANVAS / 2, CANVAS - 40);
      }
    }

    // ===== 배지 (우상단, 절제된 필 스타일) =====
    if (badge && badge !== "없음") {
      ctx.font = jp(30, 700);
      const tw = ctx.measureText(badge).width;
      const bw = tw + 56;
      const bh = 62;
      const bx = CANVAS - bw - 44;
      const by = 44;
      ctx.fillStyle = "rgba(28,25,23,0.82)";
      roundRect(ctx, bx, by, bw, bh, 31);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.fillText(badge, bx + bw / 2, by + 42);
    }
  }, [img, imgErr, template, focus, zoom, badge, brandText, showPrice, sel, serifFamily, jpFamily, fontsReady]);

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
    }, "image/jpeg", 0.92);
  };

  const saveToProduct = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !sel) return;
    // 저장용은 640px로 축소 (DB 부담 절감)
    const small = document.createElement("canvas");
    small.width = 640; small.height = 640;
    small.getContext("2d")!.drawImage(canvas, 0, 0, 640, 640);
    const dataUrl = small.toDataURL("image/jpeg", 0.8);
    const res = await fetch("/api/products/thumbnail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: sel.id, thumbnail_made_url: dataUrl }),
    });
    if (res.ok) setSavedMark(true);
  };

  return (
    <div className="min-h-screen bg-stone-50 p-4 md:p-6">
      {/* 폰트 패밀리명 판독용 (화면 밖) */}
      <span ref={serifProbe} className={serifFont.className} style={{ position: "absolute", left: -9999, top: -9999 }}>F</span>
      <span ref={jpProbe} className={jpFont.className} style={{ position: "absolute", left: -9999, top: -9999 }}>字</span>

      <div className="max-w-6xl mx-auto">
        <div className="mb-5">
          <h1 className="text-xl font-bold text-stone-900">🎨 썸네일 제작 스튜디오</h1>
          <p className="text-sm text-stone-500 mt-1">
            원본 해상도(org) 자동 로드 · <b className="text-rose-600">모델 얼굴 없는 컷</b>으로 제작하세요
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr_270px] gap-4">
          {/* 상품 목록 */}
          <div className="bg-white rounded-2xl ring-1 ring-stone-200 p-2 h-[640px] overflow-y-auto">
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
              className="w-full max-w-[540px] aspect-square rounded-xl ring-1 ring-stone-100 shadow-sm"
            />
          </div>

          {/* 컨트롤 */}
          <div className="bg-white rounded-2xl ring-1 ring-stone-200 p-4 space-y-4">
            <Control label="템플릿">
              <div className="space-y-1.5">
                {TEMPLATES.map((t) => (
                  <button key={t.id} onClick={() => setTemplate(t.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition ${template === t.id ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-500 hover:bg-stone-200"}`}>
                    <span>{t.label}</span>
                    <span className={`text-[10px] font-normal ${template === t.id ? "text-stone-300" : "text-stone-400"}`}>{t.desc}</span>
                  </button>
                ))}
              </div>
            </Control>

            <Control label="배지">
              <div className="flex flex-wrap gap-1">
                {BADGES.map((b) => (
                  <button key={b} onClick={() => setBadge(b)}
                    className={`px-2 py-1 rounded-md text-[11px] font-medium ${badge === b ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-500"}`}>
                    {b}
                  </button>
                ))}
              </div>
            </Control>

            <Control label="브랜드 표기">
              <input value={brandText} onChange={(e) => setBrandText(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg ring-1 ring-stone-200 text-sm focus:outline-none focus:ring-stone-400" />
            </Control>

            <label className="flex items-center gap-2 text-[11px] font-medium text-stone-600 cursor-pointer">
              <input type="checkbox" checked={showPrice} onChange={(e) => setShowPrice(e.target.checked)} className="accent-stone-900" />
              가격 표시 (¥)
            </label>

            <Control label={`세로 위치 (얼굴 회피) — ${focus < 0.35 ? "위쪽" : focus > 0.65 ? "아래쪽" : "중앙"}`}>
              <input type="range" min={0} max={1} step={0.05} value={focus}
                onChange={(e) => setFocus(+e.target.value)} className="w-full accent-stone-900" />
            </Control>

            <Control label={`확대 ${zoom.toFixed(2)}x`}>
              <input type="range" min={1} max={2.2} step={0.05} value={zoom}
                onChange={(e) => setZoom(+e.target.value)} className="w-full accent-stone-900" />
            </Control>

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
                <Download className="w-4 h-4" /> 다운로드 (1080px)
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
  if (r <= 0) { ctx.rect(x, y, w, h); return; }
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

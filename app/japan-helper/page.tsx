"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Languages, Copy, Check, Sparkles, RefreshCw, ChevronDown,
  MessageSquare, Crown, Ruler, Star, Zap, Heart, Package,
  AlertCircle,
} from "lucide-react";
import type { Order } from "@/lib/types";
import clsx from "clsx";

// ─── 상수 ────────────────────────────────────────────────────────────────────

const KEYWORD_OPTIONS = [
  { id: "tax", jp: "関税込み", kr: "관세 포함" },
  { id: "new", jp: "日本未入荷", kr: "일본 미입하" },
  { id: "popular", jp: "韓国大人気", kr: "한국 대인기" },
  { id: "idol", jp: "K-POPアイドル着用", kr: "K팝 아이돌 착용" },
  { id: "auth", jp: "正規品保証", kr: "정품 보증" },
  { id: "limited", jp: "限定アイテム", kr: "한정 아이템" },
  { id: "fast", jp: "即発送可能", kr: "즉시 발송" },
  { id: "free", jp: "送料込み", kr: "배송비 포함" },
];

const CATEGORIES = ["패션/의류", "패션잡화", "뷰티/화장품", "라이프스타일", "문화상품/굿즈", "신발", "액세서리"];

const SITUATIONS = [
  { id: "orderThanks", icon: "🎉", label: "주문 감사", desc: "구매 직후" },
  { id: "shipped", icon: "🚀", label: "발송 완료", desc: "운송장 포함" },
  { id: "arrived", icon: "📦", label: "도착 확인", desc: "결제 완료 요청" },
  { id: "inquiry", icon: "💬", label: "문의 답변", desc: "사이즈·재고·배송" },
  { id: "vipThanks", icon: "💕", label: "리피터 감사", desc: "2회+ 구매자" },
  { id: "vipNew", icon: "✨", label: "신상 알림", desc: "VIP 고객용" },
  { id: "coupon", icon: "🎁", label: "할인 혜택", desc: "쿠폰 안내" },
  { id: "apology", icon: "🙇", label: "사과 메시지", desc: "불만 대응" },
] as const;

type SituationId = typeof SITUATIONS[number]["id"];
const INQUIRY_TYPES = [
  { id: "size", label: "사이즈 문의" },
  { id: "stock", label: "재고 문의" },
  { id: "shipping", label: "발송 기간" },
  { id: "general", label: "일반 문의" },
];

// ─── 사이즈 테이블 ────────────────────────────────────────────────────────────

const TOPS_SIZES = [
  { kr: "FREE", intl: "F", jp: "F（M〜L相当）", chest: "80〜90", shoulder: "38〜43" },
  { kr: "44 / XS", intl: "XS", jp: "S前後 / 7号", chest: "76〜80", shoulder: "36〜38" },
  { kr: "55 / S", intl: "S", jp: "S / 9号", chest: "80〜84", shoulder: "38〜40" },
  { kr: "66 / M", intl: "M", jp: "M / 11号", chest: "84〜88", shoulder: "40〜42" },
  { kr: "77 / L", intl: "L", jp: "L / 13号", chest: "88〜92", shoulder: "42〜44" },
  { kr: "88 / XL", intl: "XL", jp: "L〜XL / 15号", chest: "92〜96", shoulder: "44〜46" },
];

const BOTTOMS_SIZES = [
  { kr: "44 / XS", intl: "XS", jp: "S", waist: "60〜62", hip: "84〜86" },
  { kr: "55 / S", intl: "S", jp: "S〜M", waist: "63〜66", hip: "87〜90" },
  { kr: "66 / M", intl: "M", jp: "M", waist: "67〜70", hip: "91〜94" },
  { kr: "77 / L", intl: "L", jp: "L", waist: "71〜74", hip: "95〜98" },
  { kr: "88 / XL", intl: "XL", jp: "L〜XL", waist: "75〜78", hip: "99〜102" },
];

const SHOES_SIZES = [
  { kr: "220", jp: "22.0 cm", eu: "35", usW: "4.5" },
  { kr: "225", jp: "22.5 cm", eu: "35.5", usW: "5" },
  { kr: "230", jp: "23.0 cm", eu: "36", usW: "5.5" },
  { kr: "235", jp: "23.5 cm", eu: "37", usW: "6" },
  { kr: "240", jp: "24.0 cm", eu: "37.5", usW: "6.5" },
  { kr: "245", jp: "24.5 cm", eu: "38", usW: "7" },
  { kr: "250", jp: "25.0 cm", eu: "38.5", usW: "7.5" },
  { kr: "255", jp: "25.5 cm", eu: "39", usW: "8" },
  { kr: "260", jp: "26.0 cm", eu: "40", usW: "8.5" },
  { kr: "265", jp: "26.5 cm", eu: "40.5", usW: "9" },
  { kr: "270", jp: "27.0 cm", eu: "41", usW: "9.5" },
];

// ─── 기본 템플릿 (즉시 사용) ──────────────────────────────────────────────────

function buildTemplate(situation: SituationId, form: {
  buyerName: string; productName: string; trackingNumber: string;
  inquiryType: string; details: string; brand: string;
}): string {
  const b = form.buyerName || "お客様";
  const p = form.productName || "ご注文商品";
  const t = form.trackingNumber || "（確定次第ご連絡いたします）";

  const tpl: Record<SituationId, string> = {
    orderThanks:
      `${b}様\n\nこの度はご注文いただき、誠にありがとうございます🙏\n\nご注文内容を確認いたしました。\n心を込めて丁寧に梱包し、お送りいたします✨\n\n■ ご注文商品\n${p}\n\n発送準備が整い次第、追跡番号をご連絡いたします。\n通常、ご注文から3〜7営業日以内に発送いたします。\n\nご不明な点がございましたら、お気軽にメッセージをお送りください😊\nどうぞよろしくお願いいたします。`,

    shipped:
      `${b}様\n\nお荷物を発送いたしました🚀\n\n■ 発送情報\n商品：${p}\n配送業者：OCS国際宅急便\n追跡番号：${t}\n\n追跡はこちらからご確認いただけます。\nhttps://www.ocs.jp/\n\n日本到着まで通常5〜10日程度かかります。\nお届け後、ぜひ受取評価をいただけますと幸いです⭐\n\nどうぞよろしくお願いいたします。`,

    arrived:
      `${b}様\n\nその後、${p}はお手元に届いておりますでしょうか？🎁\n\n商品の状態はいかがでしょうか。\nもし何かお気に召さない点がございましたら、遠慮なくご連絡ください。\n\nよろしければBUYMAの評価をいただけますと、大変励みになります⭐\n\n今後ともどうぞよろしくお願いいたします😊`,

    inquiry:
      `${b}様\n\nお問い合わせいただきありがとうございます😊\n\n${{
        size: `${p}のサイズについてご案内いたします。\n\n${form.details || "ご希望のサイズをお知らせいただければ、詳細をご案内いたします。"}`,
        stock: `${p}の在庫状況についてご案内いたします。\n\n${form.details || "現在の在庫状況をご確認の上、改めてご連絡いたします。"}`,
        shipping: `発送期間についてご案内いたします。\n\nご注文から通常3〜7営業日以内に発送いたします。\n日本到着まで発送後5〜10日程度かかります。\n${form.details || ""}`,
        general: form.details || "ご質問の件について、確認の上ご連絡いたします。",
      }[form.inquiryType] || form.details || "ご質問の件、確認いたします。"}\n\nご不明な点がございましたら、何でもお気軽にご質問ください。\nどうぞよろしくお願いいたします。`,

    vipThanks:
      `${b}様\n\nいつもご利用いただき、誠にありがとうございます💕\n\n${b}様にはいつも温かくご支援いただき、大変感謝しております✨\n今回も${p}をお選びいただき、嬉しい限りです🎀\n\n心を込めて丁寧にご対応させていただきます。\nまたのご利用を心よりお待ちしております。\nどうぞよろしくお願いいたします。`,

    vipNew:
      `${b}様\n\nいつも大変お世話になっております💕\n\n${b}様に先行してお知らせしたい新着アイテムがございます✨\n\n【新着アイテム】\n${p}${form.brand || form.details ? `\nブランド：${form.brand || form.details}` : ""}\n\n日本未入荷のアイテムで、韓国でも大変人気となっております🔥\nご興味がございましたら、お気軽にメッセージをお送りください😊\n\nどうぞよろしくお願いいたします。`,

    coupon:
      `${b}様\n\nいつもご愛顧いただき、誠にありがとうございます😊\n\n${b}様への日頃の感謝を込めて、特別なご優待をご用意いたしました🎁\n\n次回ご購入の際に、お値引きのご相談を承ります✨\nご希望の商品がございましたら、ご購入前にお気軽にメッセージください。\n\n今後ともどうぞよろしくお願いいたします💕`,

    apology:
      `${b}様\n\nこの度は大変ご不便とご迷惑をおかけしてしまい、\n誠に申し訳ございません🙇\n\n${form.details || "ご指摘の件につきまして、確認し早急に対応いたします。"}\n\n${b}様にご満足いただけるよう、誠心誠意対応いたします。\n改めてご連絡させていただきますので、\nどうぞよろしくお願いいたします。`,
  };

  return tpl[situation] ?? "";
}

// ─── 공유 컴포넌트 ────────────────────────────────────────────────────────────

function CopyBtn({ text, label = "복사" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className={clsx("flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg transition-all font-medium", copied ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? "복사됨!" : label}
    </button>
  );
}

function ResultBox({ text, label }: { text: string; label?: string }) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        {label && <span className="text-xs font-medium text-gray-500">{label}</span>}
        <CopyBtn text={text} />
      </div>
      <pre className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed font-sans">{text}</pre>
    </div>
  );
}

// ─── Tab 1: 상품 등록 도우미 ──────────────────────────────────────────────────

interface ListingResult { title: string; subtitle: string; description: string; searchKeywords: string[]; tip: string; }

function ListingTab() {
  const [form, setForm] = useState({ productName: "", brand: "", category: "패션/의류", description: "", sizes: "" });
  const [keywords, setKeywords] = useState<string[]>(["tax", "new", "popular"]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ListingResult | null>(null);
  const [error, setError] = useState("");

  function toggleKw(id: string) {
    setKeywords(k => k.includes(id) ? k.filter(x => x !== id) : [...k, id]);
  }

  async function generate() {
    if (!form.productName.trim()) { setError("상품명을 입력해주세요."); return; }
    setLoading(true); setError(""); setResult(null);
    const selectedKw = KEYWORD_OPTIONS.filter(k => keywords.includes(k.id)).map(k => k.jp);
    const res = await fetch("/api/japan-helper", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "listing", ...form, keywords: selectedKw }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? "생성 실패"); setLoading(false); return; }
    setResult(data.result);
    setLoading(false);
  }

  return (
    <div className="space-y-5">
      {/* 입력 폼 */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2"><Package size={15} className="text-indigo-500" /> 상품 정보 입력</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">상품명 (한국어) *</label>
            <input value={form.productName} onChange={e => setForm(f => ({ ...f, productName: e.target.value }))} placeholder="예: 마틴킴 오버핏 데님 재킷" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">브랜드</label>
            <input value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} placeholder="예: Matin Kim" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">카테고리</label>
            <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">사이즈 정보</label>
            <input value={form.sizes} onChange={e => setForm(f => ({ ...f, sizes: e.target.value }))} placeholder="예: FREE / S・M・L / 55・66・77" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-gray-500 mb-1 block">한국어 설명 (선택)</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} placeholder="소재, 핏, 특징 등 자유롭게 입력" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none" />
          </div>
        </div>

        {/* 키워드 선택 */}
        <div>
          <label className="text-xs text-gray-500 mb-2 block">포함할 최적화 키워드</label>
          <div className="flex flex-wrap gap-2">
            {KEYWORD_OPTIONS.map(kw => (
              <button key={kw.id} onClick={() => toggleKw(kw.id)}
                className={clsx("text-xs px-3 py-1.5 rounded-full border font-medium transition-all", keywords.includes(kw.id) ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600 border-gray-300 hover:border-indigo-400")}>
                {kw.jp} <span className="opacity-70">({kw.kr})</span>
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-500 flex items-center gap-1"><AlertCircle size={13} /> {error}</p>}

        <button onClick={generate} disabled={loading}
          className="w-full py-2.5 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2">
          {loading ? <><RefreshCw size={15} className="animate-spin" /> AI 생성 중...</> : <><Sparkles size={15} /> 일본어 상품 텍스트 생성</>}
        </button>
      </div>

      {/* 결과 */}
      {result && (
        <div className="space-y-3">
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-indigo-700 flex items-center gap-1"><Star size={12} /> 최적화 타이틀</span>
              <CopyBtn text={result.title} />
            </div>
            <p className="text-base font-bold text-gray-900 leading-snug">{result.title}</p>
            {result.subtitle && (
              <p className="text-sm text-gray-600 mt-1 border-t border-indigo-100 pt-1">{result.subtitle}</p>
            )}
          </div>

          <ResultBox text={result.description} label="📝 상품 설명 전문" />

          {result.searchKeywords?.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-500">🔍 추천 검색 키워드</span>
                <CopyBtn text={result.searchKeywords.join(" ")} label="전체 복사" />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {result.searchKeywords.map((kw, i) => (
                  <button key={i} onClick={() => navigator.clipboard.writeText(kw)}
                    className="text-xs bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full hover:bg-gray-200 transition-colors">{kw}</button>
                ))}
              </div>
            </div>
          )}

          {result.tip && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-xs text-yellow-800 flex gap-2">
              <Zap size={13} className="text-yellow-500 shrink-0 mt-0.5" />
              <span>{result.tip}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Tab 2: 메시지 템플릿 ─────────────────────────────────────────────────────

function MessageTab() {
  const [situation, setSituation] = useState<SituationId>("orderThanks");
  const [form, setForm] = useState({ buyerName: "", productName: "", trackingNumber: "", inquiryType: "size", details: "", brand: "" });
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMessage, setAiMessage] = useState("");

  const staticMsg = useMemo(() => buildTemplate(situation, form), [situation, form]);

  async function generateAi() {
    setAiLoading(true); setAiMessage("");
    const res = await fetch("/api/japan-helper", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "customMessage", situation, ...form, isVip: situation === "vipThanks" || situation === "vipNew" }),
    });
    const data = await res.json();
    setAiMessage(data.result ?? "");
    setAiLoading(false);
  }

  function upd(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); setAiMessage(""); }

  const sit = SITUATIONS.find(s => s.id === situation)!;

  return (
    <div className="space-y-5">
      {/* 상황 선택 */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2"><MessageSquare size={15} className="text-blue-500" /> 상황 선택</h3>
        <div className="grid grid-cols-4 gap-2">
          {SITUATIONS.map(s => (
            <button key={s.id} onClick={() => { setSituation(s.id); setAiMessage(""); }}
              className={clsx("p-3 rounded-xl border text-left transition-all", situation === s.id ? "bg-indigo-50 border-indigo-400 text-indigo-700" : "bg-white border-gray-200 hover:border-gray-300 text-gray-700")}>
              <div className="text-lg mb-0.5">{s.icon}</div>
              <div className="text-xs font-semibold leading-tight">{s.label}</div>
              <div className="text-xs text-gray-400 leading-tight mt-0.5">{s.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* 입력 필드 */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <h3 className="font-semibold text-gray-800 text-sm">{sit.icon} {sit.label} 정보 입력</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">구매자명 (日本語)</label>
            <input value={form.buyerName} onChange={e => upd("buyerName", e.target.value)} placeholder="예: 田中様 또는 お客様" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
          {situation !== "coupon" && (
            <div>
              <label className="text-xs text-gray-500 mb-1 block">상품명</label>
              <input value={form.productName} onChange={e => upd("productName", e.target.value)} placeholder="판매 상품명" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
          )}
          {situation === "shipped" && (
            <div>
              <label className="text-xs text-gray-500 mb-1 block">OCS 운송장 번호</label>
              <input value={form.trackingNumber} onChange={e => upd("trackingNumber", e.target.value)} placeholder="운송장 번호" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
          )}
          {situation === "inquiry" && (
            <div>
              <label className="text-xs text-gray-500 mb-1 block">문의 유형</label>
              <select value={form.inquiryType} onChange={e => upd("inquiryType", e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                {INQUIRY_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
          )}
          {(situation === "vipNew") && (
            <div>
              <label className="text-xs text-gray-500 mb-1 block">브랜드</label>
              <input value={form.brand} onChange={e => upd("brand", e.target.value)} placeholder="예: Matin Kim" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
          )}
          {(situation === "inquiry" || situation === "apology") && (
            <div className="col-span-2">
              <label className="text-xs text-gray-500 mb-1 block">{situation === "apology" ? "사과 내용 / 문제 상황" : "구체적인 답변 내용"}</label>
              <textarea value={form.details} onChange={e => upd("details", e.target.value)} rows={2} placeholder={situation === "apology" ? "문제 상황 설명" : "답변할 내용을 입력하면 메시지에 반영됩니다"} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none" />
            </div>
          )}
        </div>
      </div>

      {/* 기본 템플릿 */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="bg-blue-50 px-4 py-2.5 border-b border-gray-200 flex items-center justify-between">
          <span className="text-sm font-medium text-blue-800">📋 기본 템플릿 (즉시 사용 가능)</span>
          <CopyBtn text={staticMsg} />
        </div>
        <pre className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed p-4 font-sans">{staticMsg}</pre>
      </div>

      {/* AI 커스텀 */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="bg-purple-50 px-4 py-2.5 border-b border-gray-200 flex items-center justify-between">
          <span className="text-sm font-medium text-purple-800 flex items-center gap-1.5"><Sparkles size={13} /> AI 커스텀 메시지 (더 개인화됨)</span>
          {aiMessage && <CopyBtn text={aiMessage} />}
        </div>
        <div className="p-4">
          {aiMessage ? (
            <pre className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed font-sans">{aiMessage}</pre>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-gray-400 mb-3">Claude AI가 입력한 정보를 바탕으로 더 개인화된 메시지를 생성합니다</p>
              <button onClick={generateAi} disabled={aiLoading}
                className="px-5 py-2 bg-purple-600 text-white rounded-xl text-sm font-medium hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1.5 mx-auto">
                {aiLoading ? <><RefreshCw size={13} className="animate-spin" /> 생성 중...</> : <><Sparkles size={13} /> AI 커스텀 생성</>}
              </button>
            </div>
          )}
          {aiMessage && (
            <button onClick={generateAi} disabled={aiLoading}
              className="mt-3 text-xs text-purple-600 hover:text-purple-800 flex items-center gap-1">
              <RefreshCw size={11} /> 다시 생성
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Tab 3: 리피터 관리 ───────────────────────────────────────────────────────

function RepeaterTab() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [genType, setGenType] = useState<Record<string, SituationId>>({});

  useEffect(() => {
    fetch("/api/sheets/orders").then(r => r.json()).then(d => { setOrders(d.orders ?? []); setLoading(false); });
  }, []);

  const repeaters = useMemo(() => {
    const map: Record<string, { name: string; count: number; totalJpy: number; lastDate: string; products: string[] }> = {};
    for (const o of orders) {
      if (!o.buyerName) continue;
      if (!map[o.buyerName]) map[o.buyerName] = { name: o.buyerName, count: 0, totalJpy: 0, lastDate: "", products: [] };
      const c = map[o.buyerName];
      c.count++;
      c.totalJpy += o.sellingPrice || 0;
      if (o.orderDate > (c.lastDate || "")) c.lastDate = o.orderDate;
      if (o.productName && !c.products.includes(o.productName)) c.products.push(o.productName);
    }
    return Object.values(map).filter(c => c.count >= 2).sort((a, b) => b.count - a.count);
  }, [orders]);

  async function genMessage(customer: typeof repeaters[0], type: SituationId) {
    setGenerating(customer.name);
    setGenType(t => ({ ...t, [customer.name]: type }));
    const res = await fetch("/api/japan-helper", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "customMessage",
        situation: type,
        buyerName: customer.name,
        productName: customer.products.slice(-1)[0] || "",
        isVip: true,
      }),
    });
    const data = await res.json();
    setMessages(m => ({ ...m, [customer.name]: data.result ?? "" }));
    setGenerating(null);
  }

  if (loading) return <div className="flex items-center justify-center py-12 text-gray-400"><RefreshCw size={16} className="animate-spin mr-2" /> 불러오는 중...</div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "리피터 고객", count: repeaters.length, color: "text-indigo-600" },
          { label: "VIP (5회+)", count: repeaters.filter(c => c.count >= 5).length, color: "text-yellow-600" },
          { label: "총 리피터 매출", count: `¥${repeaters.reduce((s, c) => s + c.totalJpy, 0).toLocaleString()}`, color: "text-green-600" },
        ].map(({ label, count, color }) => (
          <div key={label} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className={clsx("text-xl font-bold", color)}>{count}</div>
            <div className="text-sm text-gray-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {repeaters.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-200 rounded-xl p-8 text-center text-gray-400 text-sm">
          아직 2회 이상 구매한 고객이 없습니다. 주문이 쌓이면 자동으로 표시됩니다.
        </div>
      ) : (
        <div className="space-y-3">
          {repeaters.map(c => (
            <div key={c.name} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  {c.count >= 5 ? <Crown size={16} className="text-yellow-500" /> : <Heart size={15} className="text-pink-400" />}
                  <div>
                    <span className="font-semibold text-gray-900">{c.name}</span>
                    {c.count >= 5 && <span className="ml-2 text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full">VIP</span>}
                    <div className="text-xs text-gray-400 mt-0.5">{c.count}회 구매 · ¥{c.totalJpy.toLocaleString()} · 최근 {c.lastDate}</div>
                  </div>
                </div>
                <div className="flex gap-1.5 shrink-0 flex-wrap justify-end">
                  {[
                    { type: "vipThanks" as SituationId, label: "💕 감사 메시지", cls: "bg-pink-50 text-pink-700 border-pink-200" },
                    { type: "vipNew" as SituationId, label: "✨ 신상 알림", cls: "bg-purple-50 text-purple-700 border-purple-200" },
                    { type: "coupon" as SituationId, label: "🎁 쿠폰 안내", cls: "bg-yellow-50 text-yellow-700 border-yellow-200" },
                  ].map(({ type, label, cls }) => (
                    <button key={type} onClick={() => genMessage(c, type)} disabled={generating === c.name}
                      className={clsx("text-xs px-2.5 py-1.5 rounded-lg border font-medium transition-all", cls, generating === c.name && genType[c.name] === type ? "opacity-50" : "hover:opacity-80")}>
                      {generating === c.name && genType[c.name] === type ? <><RefreshCw size={10} className="inline animate-spin mr-0.5" />생성중</> : label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 구매 상품 목록 */}
              <div className="text-xs text-gray-400 mb-3 flex flex-wrap gap-1">
                {c.products.slice(0, 3).map((p, i) => (
                  <span key={i} className="bg-gray-50 px-2 py-0.5 rounded border border-gray-100">{p}</span>
                ))}
                {c.products.length > 3 && <span className="text-gray-300">+{c.products.length - 3}개</span>}
              </div>

              {/* 생성된 메시지 */}
              {messages[c.name] && (
                <div className="border border-gray-100 rounded-xl overflow-hidden">
                  <div className="bg-gray-50 px-3 py-2 flex items-center justify-between border-b border-gray-100">
                    <span className="text-xs text-gray-500">생성된 메시지</span>
                    <div className="flex gap-2">
                      <CopyBtn text={messages[c.name]} />
                      <button onClick={() => setMessages(m => { const n = { ...m }; delete n[c.name]; return n; })} className="text-xs text-gray-400 hover:text-gray-600 px-1">✕</button>
                    </div>
                  </div>
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed p-3 font-sans">{messages[c.name]}</pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tab 4: 사이즈 가이드 ─────────────────────────────────────────────────────

function SizeGuideTab() {
  const [sizeType, setSizeType] = useState<"tops" | "bottoms" | "shoes">("tops");
  const [measurements, setMeasurements] = useState("");
  const [brand, setBrand] = useState("");
  const [loading, setLoading] = useState(false);
  const [guide, setGuide] = useState("");

  async function generate() {
    setLoading(true); setGuide("");
    const res = await fetch("/api/japan-helper", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "sizeGuide", sizeType, measurements, brand }),
    });
    const data = await res.json();
    setGuide(data.result ?? "");
    setLoading(false);
  }

  const TABLE_TYPES = [
    { id: "tops", label: "👕 상의" },
    { id: "bottoms", label: "👖 하의" },
    { id: "shoes", label: "👟 신발" },
  ] as const;

  return (
    <div className="space-y-4">
      {/* 타입 선택 */}
      <div className="flex gap-2">
        {TABLE_TYPES.map(t => (
          <button key={t.id} onClick={() => setSizeType(t.id)}
            className={clsx("px-4 py-2 rounded-lg text-sm font-medium border transition-all", sizeType === t.id ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600 border-gray-300 hover:border-gray-400")}>
            {t.label}
          </button>
        ))}
      </div>

      {/* 정적 사이즈 표 */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-700 flex items-center gap-1.5"><Ruler size={14} /> 한국↔일본 사이즈 변환표</span>
          <CopyBtn text={
            sizeType === "tops"
              ? TOPS_SIZES.map(r => `${r.kr} → ${r.jp}（胸囲${r.chest}cm）`).join("\n")
              : sizeType === "bottoms"
                ? BOTTOMS_SIZES.map(r => `${r.kr} → ${r.jp}（ウエスト${r.waist}cm）`).join("\n")
                : SHOES_SIZES.map(r => `${r.kr}mm → ${r.jp}（EU${r.eu}）`).join("\n")
          } label="표 복사" />
        </div>
        <div className="overflow-x-auto">
          {sizeType === "tops" && (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>{["한국 사이즈", "인터내셔널", "일본 사이즈", "胸囲 (cm)", "肩幅 (cm)"].map(h => <th key={h} className="p-3 text-left font-medium text-gray-600 text-xs">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {TOPS_SIZES.map(r => (
                  <tr key={r.kr} className="hover:bg-gray-50">
                    <td className="p-3 font-medium text-gray-800">{r.kr}</td>
                    <td className="p-3 text-gray-600">{r.intl}</td>
                    <td className="p-3 font-semibold text-indigo-700">{r.jp}</td>
                    <td className="p-3 text-gray-500">{r.chest}</td>
                    <td className="p-3 text-gray-500">{r.shoulder}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {sizeType === "bottoms" && (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>{["한국 사이즈", "인터내셔널", "일본 사이즈", "ウエスト (cm)", "ヒップ (cm)"].map(h => <th key={h} className="p-3 text-left font-medium text-gray-600 text-xs">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {BOTTOMS_SIZES.map(r => (
                  <tr key={r.kr} className="hover:bg-gray-50">
                    <td className="p-3 font-medium text-gray-800">{r.kr}</td>
                    <td className="p-3 text-gray-600">{r.intl}</td>
                    <td className="p-3 font-semibold text-indigo-700">{r.jp}</td>
                    <td className="p-3 text-gray-500">{r.waist}</td>
                    <td className="p-3 text-gray-500">{r.hip}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {sizeType === "shoes" && (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>{["한국 (mm)", "일본 (cm)", "EU", "US Women"].map(h => <th key={h} className="p-3 text-left font-medium text-gray-600 text-xs">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {SHOES_SIZES.map(r => (
                  <tr key={r.kr} className="hover:bg-gray-50">
                    <td className="p-3 font-medium text-gray-800">{r.kr}</td>
                    <td className="p-3 font-semibold text-indigo-700">{r.jp}</td>
                    <td className="p-3 text-gray-600">{r.eu}</td>
                    <td className="p-3 text-gray-500">{r.usW}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* AI 사이즈 가이드 생성 */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <h3 className="font-semibold text-gray-800 text-sm flex items-center gap-2"><Sparkles size={14} className="text-purple-500" /> AI 일본어 사이즈 안내 문구 생성</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">브랜드 / 상품명</label>
            <input value={brand} onChange={e => setBrand(e.target.value)} placeholder="예: Matin Kim 재킷" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">사이즈 정보 입력</label>
            <input value={measurements} onChange={e => setMeasurements(e.target.value)} placeholder="예: FREE (어깨 38~43cm, 가슴 80~90cm)" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
        </div>
        <button onClick={generate} disabled={loading}
          className="w-full py-2.5 bg-purple-600 text-white rounded-xl font-semibold text-sm hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2">
          {loading ? <><RefreshCw size={14} className="animate-spin" /> 생성 중...</> : <><Sparkles size={14} /> 일본어 사이즈 안내 생성</>}
        </button>
        {guide && <ResultBox text={guide} label="생성된 일본어 사이즈 안내" />}
      </div>
    </div>
  );
}

// ─── 메인 페이지 ──────────────────────────────────────────────────────────────

type Tab = "listing" | "message" | "repeater" | "sizeGuide";

export default function JapanHelperPage() {
  const [tab, setTab] = useState<Tab>("listing");

  const TABS: { id: Tab; icon: string; label: string; sub: string }[] = [
    { id: "listing", icon: "📦", label: "상품 등록 도우미", sub: "한→일 번역 최적화" },
    { id: "message", icon: "💬", label: "메시지 템플릿", sub: "상황별 일본어" },
    { id: "repeater", icon: "👑", label: "리피터 관리", sub: "단골 메시지 생성" },
    { id: "sizeGuide", icon: "📏", label: "사이즈 가이드", sub: "한↔일 사이즈 변환" },
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Languages size={22} className="text-indigo-600" /> 일본 구매자 단골 만들기
        </h1>
        <p className="text-sm text-gray-500 mt-1">상품 등록 최적화 · 상황별 메시지 · 리피터 관리 · 사이즈 가이드</p>
      </div>

      {/* 탭 */}
      <div className="grid grid-cols-4 gap-2 mb-6">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={clsx("p-3 rounded-xl border text-left transition-all", tab === t.id ? "bg-indigo-600 text-white border-indigo-600 shadow-sm" : "bg-white text-gray-700 border-gray-200 hover:border-indigo-300")}>
            <div className="text-xl mb-0.5">{t.icon}</div>
            <div className={clsx("text-xs font-semibold leading-tight", tab === t.id ? "text-white" : "text-gray-800")}>{t.label}</div>
            <div className={clsx("text-xs leading-tight mt-0.5", tab === t.id ? "text-indigo-200" : "text-gray-400")}>{t.sub}</div>
          </button>
        ))}
      </div>

      {tab === "listing" && <ListingTab />}
      {tab === "message" && <MessageTab />}
      {tab === "repeater" && <RepeaterTab />}
      {tab === "sizeGuide" && <SizeGuideTab />}
    </div>
  );
}

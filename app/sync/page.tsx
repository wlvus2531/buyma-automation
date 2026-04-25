"use client";

import { useState, useEffect } from "react";
import { RefreshCw, CheckCircle, XCircle, FileSpreadsheet, Info, Save, Code, Copy, Check, ChevronDown, ChevronUp } from "lucide-react";

interface SyncState {
  status: "idle" | "running" | "success" | "error";
  message: string;
  count?: number;
}

const APPS_SCRIPT_CODE = `// 바이마 자동화 시스템 - Google Apps Script
// 구글 시트 > 확장 프로그램 > Apps Script 에 붙여넣은 뒤
// 배포 > 새 배포 > 웹앱으로 배포하세요
// (실행 계정: 나 / 액세스 권한: 모든 사용자)

const SOURCING_HEADERS = [
  "ID","상품명","카테고리","브랜드","한국구매가(KRW)","바이마최저가(JPY)",
  "내판매가(JPY)","경쟁자수","상태","환급포함마진율(%)","환급제외마진율(%)",
  "배송비(KRW)","환율(KRW/JPY)","메모","등록일"
];

const ORDERS_HEADERS = [
  "ID","주문번호","상품명","구매자명","판매가(JPY)","매입가(KRW)",
  "배송비(KRW)","환율","상태","운송장번호","주문일","발송일","정산일",
  "마진(JPY)","마진율(%)","메모"
];

function doPost(e) {
  try {
    var p = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    if (p.action === "syncSourcing") {
      var rows = (p.items || []).map(function(i) {
        return [i.id, i.productName, i.category, i.brand,
          i.koreaPurchasePrice, i.buymaLowestPrice, i.sellingPrice,
          i.competitorCount, i.status, i.marginWithRefund,
          i.marginWithoutRefund, i.shippingCost, i.exchangeRate,
          i.notes, i.createdAt];
      });
      writeSheet(ss, "소싱리스트", SOURCING_HEADERS, rows);
      return respond({success: true, count: rows.length});
    }

    if (p.action === "syncOrders") {
      var rows = (p.orders || []).map(function(o) {
        return [o.id, o.orderNumber, o.productName, o.buyerName,
          o.sellingPrice, o.purchasePrice, o.shippingCost, o.exchangeRate,
          o.status, o.trackingNumber, o.orderDate, o.shippedDate,
          o.settledDate, o.marginJpy, o.marginRate, o.notes];
      });
      writeSheet(ss, "주문내역", ORDERS_HEADERS, rows);
      return respond({success: true, count: rows.length});
    }

    return respond({error: "알 수 없는 action: " + p.action});

  } catch(err) {
    return respond({error: err.toString()});
  }
}

function writeSheet(ss, name, headers, rows) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  sheet.clearContents();
  sheet.appendRow(headers);
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
}

function respond(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}`;

export default function SyncPage() {
  const [scriptUrl, setScriptUrl] = useState("");
  const [savedUrl, setSavedUrl] = useState("");
  const [urlSaved, setUrlSaved] = useState(false);
  const [sourcingSync, setSourcingSync] = useState<SyncState>({ status: "idle", message: "" });
  const [ordersSync, setOrdersSync] = useState<SyncState>({ status: "idle", message: "" });
  const [showGuide, setShowGuide] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("appsScriptUrl") ?? "";
    setScriptUrl(saved);
    setSavedUrl(saved);
  }, []);

  function saveUrl() {
    const url = scriptUrl.trim();
    localStorage.setItem("appsScriptUrl", url);
    setSavedUrl(url);
    setUrlSaved(true);
    setTimeout(() => setUrlSaved(false), 2500);
  }

  function copyCode() {
    navigator.clipboard.writeText(APPS_SCRIPT_CODE);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  }

  async function handleSync(type: "sourcing" | "orders") {
    const setter = type === "sourcing" ? setSourcingSync : setOrdersSync;

    if (!savedUrl) {
      setter({ status: "error", message: "Apps Script URL을 먼저 입력하고 저장해주세요" });
      return;
    }

    setter({ status: "running", message: "데이터 가져오는 중..." });

    try {
      const dataRes = await fetch(`/api/sheets/${type}`);
      const data = await dataRes.json();
      if (!dataRes.ok) throw new Error(data.error ?? "데이터 로드 실패");

      const list = type === "sourcing" ? data.items : data.orders;
      setter({ status: "running", message: `구글시트로 전송 중... (${list?.length ?? 0}건)` });

      const payload = type === "sourcing"
        ? { action: "syncSourcing", items: list ?? [] }
        : { action: "syncOrders", orders: list ?? [] };

      const syncRes = await fetch("/api/apps-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scriptUrl: savedUrl, ...payload }),
      });

      const result = await syncRes.json();
      if (result.error) throw new Error(result.error);

      setter({ status: "success", message: "구글시트 동기화 완료!", count: result.count });
    } catch (e) {
      setter({ status: "error", message: e instanceof Error ? e.message : "오류가 발생했습니다" });
    }
  }

  function SyncCard({ title, desc, state, onSync }: {
    title: string;
    desc: string;
    state: SyncState;
    onSync: () => void;
  }) {
    return (
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-gray-900">{title}</h3>
            <p className="text-sm text-gray-500">{desc}</p>
          </div>
          {state.status === "success" && <CheckCircle size={20} className="text-green-500" />}
          {state.status === "error" && <XCircle size={20} className="text-red-500" />}
        </div>
        {state.message && (
          <p className={`text-sm mb-3 px-3 py-2 rounded-lg ${
            state.status === "success" ? "bg-green-50 text-green-700" :
            state.status === "error" ? "bg-red-50 text-red-700" :
            "bg-gray-50 text-gray-600"
          }`}>
            {state.message}
            {state.count !== undefined && ` (${state.count}건)`}
          </p>
        )}
        <button
          onClick={onSync}
          disabled={state.status === "running"}
          className="btn-primary flex items-center gap-2 w-full justify-center"
        >
          <RefreshCw size={15} className={state.status === "running" ? "animate-spin" : ""} />
          {state.status === "running" ? "동기화 중..." : "구글시트로 동기화"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
          <FileSpreadsheet size={20} className="text-green-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">구글시트 동기화</h1>
          <p className="text-gray-500 text-sm">Apps Script 웹앱 URL로 소싱리스트·주문내역을 동기화합니다</p>
        </div>
      </div>

      {/* URL 입력 */}
      <div className="card">
        <h3 className="font-semibold text-gray-900 mb-3">Apps Script 웹앱 URL</h3>
        <div className="flex gap-2">
          <input
            type="url"
            placeholder="https://script.google.com/macros/s/.../exec"
            value={scriptUrl}
            onChange={(e) => setScriptUrl(e.target.value)}
            className="input flex-1 font-mono text-sm"
          />
          <button
            onClick={saveUrl}
            className="btn-primary flex items-center gap-2 whitespace-nowrap"
          >
            {urlSaved ? <Check size={15} /> : <Save size={15} />}
            {urlSaved ? "저장됨!" : "저장"}
          </button>
        </div>
        {savedUrl && (
          <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
            <CheckCircle size={12} />
            <span className="truncate">저장된 URL: {savedUrl}</span>
          </p>
        )}
      </div>

      {/* 설정 가이드 */}
      <div className="card">
        <button
          onClick={() => setShowGuide(!showGuide)}
          className="w-full flex items-center justify-between text-left"
        >
          <span className="font-semibold text-gray-900 flex items-center gap-2">
            <Info size={16} className="text-blue-500" />
            Apps Script 설정 방법
          </span>
          {showGuide
            ? <ChevronUp size={16} className="text-gray-400" />
            : <ChevronDown size={16} className="text-gray-400" />}
        </button>
        {showGuide && (
          <ol className="space-y-2.5 text-sm text-gray-700 mt-4 border-t border-gray-100 pt-4">
            <li className="flex gap-2">
              <span className="font-bold text-indigo-600 w-5 shrink-0">1.</span>
              <span>구글 드라이브에서 새 스프레드시트 생성</span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-indigo-600 w-5 shrink-0">2.</span>
              <span>상단 메뉴 <strong>확장 프로그램 → Apps Script</strong> 클릭</span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-indigo-600 w-5 shrink-0">3.</span>
              <span>아래 "Apps Script 코드" 섹션에서 코드를 복사해서 붙여넣기</span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-indigo-600 w-5 shrink-0">4.</span>
              <span>저장(Ctrl+S) 후 <strong>배포 → 새 배포</strong> 클릭</span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-indigo-600 w-5 shrink-0">5.</span>
              <span>유형: <strong>웹앱</strong> 선택 → 실행 계정: <strong>나</strong>, 액세스 권한: <strong>모든 사용자</strong> 설정 후 배포</span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-indigo-600 w-5 shrink-0">6.</span>
              <span>생성된 <strong>웹앱 URL</strong>을 위 입력창에 붙여넣고 저장</span>
            </li>
          </ol>
        )}
      </div>

      {/* Apps Script 코드 */}
      <div className="card">
        <button
          onClick={() => setShowCode(!showCode)}
          className="w-full flex items-center justify-between text-left"
        >
          <span className="font-semibold text-gray-900 flex items-center gap-2">
            <Code size={16} className="text-purple-500" />
            Apps Script 코드
          </span>
          {showCode
            ? <ChevronUp size={16} className="text-gray-400" />
            : <ChevronDown size={16} className="text-gray-400" />}
        </button>
        {showCode && (
          <div className="mt-4 border-t border-gray-100 pt-4">
            <button
              onClick={copyCode}
              className="btn-secondary flex items-center gap-2 mb-3"
            >
              {codeCopied
                ? <Check size={14} className="text-green-600" />
                : <Copy size={14} />}
              {codeCopied ? "복사됨!" : "코드 복사"}
            </button>
            <pre className="bg-gray-900 text-green-300 rounded-lg p-4 text-xs font-mono overflow-x-auto max-h-72 overflow-y-auto whitespace-pre">
              {APPS_SCRIPT_CODE}
            </pre>
          </div>
        )}
      </div>

      {/* 동기화 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SyncCard
          title="소싱리스트 동기화"
          desc="소싱 상품 데이터를 구글시트로 내보냅니다"
          state={sourcingSync}
          onSync={() => handleSync("sourcing")}
        />
        <SyncCard
          title="주문내역 동기화"
          desc="주문 내역 데이터를 구글시트로 내보냅니다"
          state={ordersSync}
          onSync={() => handleSync("orders")}
        />
      </div>

      {/* 시트 구조 */}
      <div className="card">
        <h3 className="font-semibold text-gray-900 mb-3">동기화되는 시트 구조</h3>
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-1">📋 소싱리스트 시트</p>
            <p className="text-xs text-gray-500 bg-gray-50 px-3 py-2 rounded-lg font-mono leading-relaxed">
              ID | 상품명 | 카테고리 | 브랜드 | 한국구매가(KRW) | 바이마최저가(JPY) | 내판매가(JPY) | 경쟁자수 | 상태 | 환급포함마진율(%) | 환급제외마진율(%) | 배송비(KRW) | 환율(KRW/JPY) | 메모 | 등록일
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700 mb-1">📦 주문내역 시트</p>
            <p className="text-xs text-gray-500 bg-gray-50 px-3 py-2 rounded-lg font-mono leading-relaxed">
              ID | 주문번호 | 상품명 | 구매자명 | 판매가(JPY) | 매입가(KRW) | 배송비(KRW) | 환율 | 상태 | 운송장번호 | 주문일 | 발송일 | 정산일 | 마진(JPY) | 마진율(%) | 메모
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

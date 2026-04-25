"use client";

import { useState, useEffect } from "react";
import { RefreshCw, CheckCircle, XCircle, FileSpreadsheet, Info, Save, Code, Copy, Check, ChevronDown, ChevronUp, Mail } from "lucide-react";

interface SyncState {
  status: "idle" | "running" | "success" | "error";
  message: string;
  count?: number;
}

const APPS_SCRIPT_CODE = `// ================================================================
// 바이마 자동화 시스템 - Google Apps Script
// ================================================================
// 【초기 설정 순서】
//   1. 이 코드 전체를 붙여넣고 저장 (Ctrl+S)
//   2. 함수 선택 드롭다운에서 setupHourlyTrigger 선택 후 실행
//      → Gmail + 시트 권한 승인 (1회)
//   3. 배포 → 새 배포 → 웹앱
//      (실행 계정: 나 / 액세스 권한: 모든 사용자)
//   4. 생성된 웹앱 URL을 앱의 동기화 페이지에 저장
// ================================================================

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

// ────────────────────────────────────────────────────────────────
// 웹앱: 앱 → 구글시트 동기화 (doPost)
// ────────────────────────────────────────────────────────────────
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

// ────────────────────────────────────────────────────────────────
// Gmail 자동 감지: 바이마 주문 이메일 → 구글시트 자동 기록
// ────────────────────────────────────────────────────────────────
var PROCESSED_LABEL = "바이마-처리완료";

function checkBuymaEmails() {
  var label = GmailApp.getUserLabelByName(PROCESSED_LABEL)
              || GmailApp.createLabel(PROCESSED_LABEL);

  var query = 'subject:"【BUYMA】新規注文" -label:' + PROCESSED_LABEL;
  var threads = GmailApp.search(query, 0, 50);

  if (!threads.length) {
    Logger.log("새 바이마 주문 이메일 없음");
    return;
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("주문내역");
  if (!sheet) {
    sheet = ss.insertSheet("주문내역");
    sheet.appendRow(ORDERS_HEADERS);
  }

  var existing = getExistingOrderNumbers(sheet);
  var added = 0;

  for (var i = 0; i < threads.length; i++) {
    var messages = threads[i].getMessages();
    for (var j = 0; j < messages.length; j++) {
      var msg = messages[j];
      if (!msg.getSubject().includes("新規注文")) continue;

      var row = parseBuymaEmail(msg.getPlainBody(), msg.getDate());
      if (!row) continue;

      var orderNum = row[1]; // 주문번호는 index 1
      if (existing.has(orderNum)) continue;

      sheet.appendRow(row);
      existing.add(orderNum);
      added++;
    }
    threads[i].addLabel(label);
  }

  Logger.log("처리: " + threads.length + "개 스레드 / 신규 " + added + "건 추가");
}

function parseBuymaEmail(body, date) {
  // 주문번호
  var orderNum = extractField(body, [
    /■?注文番号[：:\s]*\n?\s*([^\n\r■]+)/,
    /受注番号[：:]\s*([^\n\r]+)/,
    /注文No[.．]?[：:]\s*([^\n\r]+)/,
  ]);
  if (!orderNum) return null;

  // 商品名
  var productName = extractField(body, [
    /■?(?:商品名|アイテム名|出品タイトル)[：:\s]*\n?\s*([^\n\r■]+)/,
    /商品名[：:]\s*([^\n\r]+)/,
  ]) || "";

  // バイヤー名
  var buyerName = extractField(body, [
    /■?(?:バイヤー名?|購入者名?|お届け先氏名?)[：:\s]*\n?\s*([^\n\r■]+)/,
    /バイヤー[：:]\s*([^\n\r]+)/,
  ]) || "";

  // 販売価格
  var priceRaw = extractField(body, [
    /■?(?:販売価格|お支払い金額|金額)[：:\s]*\n?\s*[¥￥]?([\d,]+)/,
    /[¥￥]([\d,]+)/,
  ]) || "0";
  var sellingPrice = parseInt(priceRaw.replace(/[^0-9]/g, ""), 10) || 0;

  return [
    generateId(),    // ID
    orderNum,        // 주문번호
    productName,     // 상품명
    buyerName,       // 구매자명
    sellingPrice,    // 판매가(JPY)
    0,               // 매입가(KRW)
    0,               // 배송비(KRW)
    10.5,            // 환율
    "주문접수",       // 상태
    "",              // 운송장번호
    formatDate(date),// 주문일
    "",              // 발송일
    "",              // 정산일
    0,               // 마진(JPY)
    0,               // 마진율(%)
    "Gmail 자동감지", // 메모
  ];
}

function extractField(text, patterns) {
  for (var i = 0; i < patterns.length; i++) {
    var m = text.match(patterns[i]);
    if (m && m[1]) return m[1].trim();
  }
  return null;
}

function getExistingOrderNumbers(sheet) {
  var map = {};
  var lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    sheet.getRange(2, 2, lastRow - 1, 1).getValues()
      .forEach(function(r) { if (r[0]) map[String(r[0])] = true; });
  }
  return {
    has: function(v) { return !!map[v]; },
    add: function(v) { map[v] = true; }
  };
}

function formatDate(date) {
  var d = new Date(date);
  return d.getFullYear() + ". " + (d.getMonth() + 1) + ". " + d.getDate() + ".";
}

function generateId() {
  return "gs_" + new Date().getTime() + "_" + Math.floor(Math.random() * 9999);
}

// ────────────────────────────────────────────────────────────────
// 트리거 설정 — 이 함수를 에디터에서 1회 직접 실행
// ────────────────────────────────────────────────────────────────
function setupHourlyTrigger() {
  // 기존 트리거 중복 방지
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === "checkBuymaEmails") {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger("checkBuymaEmails")
    .timeBased()
    .everyHours(1)
    .create();

  Logger.log("트리거 등록 완료: 1시간마다 checkBuymaEmails 실행");
}

// ────────────────────────────────────────────────────────────────
// 공통 헬퍼
// ────────────────────────────────────────────────────────────────
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

      {/* Gmail 자동 감지 안내 */}
      <div className="card bg-indigo-50 border-indigo-100">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
            <Mail size={16} className="text-indigo-600" />
          </div>
          <div>
            <h3 className="font-semibold text-indigo-900 mb-1">Gmail 주문 자동 감지</h3>
            <p className="text-sm text-indigo-800 leading-relaxed">
              아래 Apps Script 코드를 배포하면 <strong>1시간마다</strong> Gmail에서
              <code className="bg-indigo-100 px-1.5 py-0.5 rounded text-xs mx-1">【BUYMA】新規注文</code>
              이메일을 자동으로 감지해 구글시트에 기록합니다.
              처리된 이메일은 <code className="bg-indigo-100 px-1.5 py-0.5 rounded text-xs mx-1">바이마-처리완료</code> 라벨이 붙어 중복 처리되지 않습니다.
            </p>
            <p className="text-xs text-indigo-600 mt-2">
              매입가·배송비·환율은 빈값으로 기록되므로 구글시트나 앱에서 직접 입력해주세요.
            </p>
          </div>
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
              <span>아래 "Apps Script 코드" 섹션에서 코드를 복사해서 붙여넣고 저장 (Ctrl+S)</span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-indigo-600 w-5 shrink-0">4.</span>
              <span>
                함수 선택 드롭다운에서 <code className="bg-gray-100 px-1.5 py-0.5 rounded">setupHourlyTrigger</code> 선택 후
                <strong> 실행 버튼(▶) 클릭</strong> → Gmail·시트 권한 승인
                <span className="block text-gray-500 text-xs mt-0.5">이 단계가 Gmail 자동 감지 트리거를 1회 등록합니다</span>
              </span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-indigo-600 w-5 shrink-0">5.</span>
              <span><strong>배포 → 새 배포</strong> → 유형: 웹앱 → 실행 계정: <strong>나</strong>, 액세스 권한: <strong>모든 사용자</strong> → 배포</span>
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
            <span className="text-xs font-normal text-gray-400">(웹앱 동기화 + Gmail 자동감지 + 트리거 설정)</span>
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
            <pre className="bg-gray-900 text-green-300 rounded-lg p-4 text-xs font-mono overflow-x-auto max-h-96 overflow-y-auto whitespace-pre">
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

"use client";

import { useState } from "react";
import { RefreshCw, CheckCircle, XCircle, ExternalLink, FileSpreadsheet, Info } from "lucide-react";

interface SyncState {
  status: "idle" | "running" | "success" | "error";
  message: string;
  count?: number;
}

export default function SyncPage() {
  const [sourcingSync, setSourcingSync] = useState<SyncState>({ status: "idle", message: "" });
  const [ordersSync, setOrdersSync] = useState<SyncState>({ status: "idle", message: "" });
  const [initStatus, setInitStatus] = useState<SyncState>({ status: "idle", message: "" });

  async function handleSync(type: "sourcing" | "orders") {
    const setter = type === "sourcing" ? setSourcingSync : setOrdersSync;
    setter({ status: "running", message: "동기화 중..." });
    try {
      const res = await fetch(`/api/sheets/${type}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "동기화 실패");
      const count = type === "sourcing" ? data.items?.length : data.orders?.length;
      setter({ status: "success", message: `동기화 완료`, count });
    } catch (e) {
      setter({ status: "error", message: e instanceof Error ? e.message : "오류" });
    }
  }

  async function handleInitSheets() {
    setInitStatus({ status: "running", message: "시트 초기화 중..." });
    try {
      const res = await fetch("/api/sheets/init", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "초기화 실패");
      setInitStatus({ status: "success", message: "구글 시트 초기화 완료! 소싱리스트·주문내역 시트가 생성되었습니다." });
    } catch (e) {
      setInitStatus({ status: "error", message: e instanceof Error ? e.message : "오류" });
    }
  }

  const spreadsheetId = process.env.NEXT_PUBLIC_SPREADSHEET_ID;

  function SyncCard({ title, desc, state, onSync }: {
    title: string; desc: string;
    state: SyncState; onSync: () => void;
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
          {state.status === "running" ? "처리 중..." : "동기화 실행"}
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
          <p className="text-gray-500 text-sm">소싱리스트·주문내역을 구글 스프레드시트와 동기화합니다</p>
        </div>
      </div>

      {/* 설정 가이드 */}
      <div className="card bg-blue-50 border-blue-100">
        <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
          <Info size={16} /> 구글 시트 연동 설정 방법
        </h3>
        <ol className="space-y-2 text-sm text-blue-800">
          <li className="flex gap-2">
            <span className="font-bold w-5">1.</span>
            <span><a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="underline">Google Cloud Console</a>에서 새 프로젝트 생성</span>
          </li>
          <li className="flex gap-2">
            <span className="font-bold w-5">2.</span>
            <span>Google Sheets API 활성화 (라이브러리 → "Google Sheets API" 검색)</span>
          </li>
          <li className="flex gap-2">
            <span className="font-bold w-5">3.</span>
            <span>서비스 계정 생성 → JSON 키 다운로드 (IAM 및 관리자 → 서비스 계정)</span>
          </li>
          <li className="flex gap-2">
            <span className="font-bold w-5">4.</span>
            <span>새 구글 스프레드시트 생성 → 서비스 계정 이메일에 편집자 권한 공유</span>
          </li>
          <li className="flex gap-2">
            <span className="font-bold w-5">5.</span>
            <span><code className="bg-blue-100 px-1 rounded">.env.local</code> 파일에 아래 환경변수 설정:</span>
          </li>
        </ol>
        <div className="mt-3 bg-blue-900 text-green-300 rounded-lg p-3 text-xs font-mono">
          <p>GOOGLE_SERVICE_ACCOUNT_EMAIL=your-account@project.iam.gserviceaccount.com</p>
          <p>GOOGLE_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n..."</p>
          <p>GOOGLE_SPREADSHEET_ID=1BxiMVs0XRA5...</p>
        </div>
      </div>

      {/* 시트 초기화 */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-gray-900">스프레드시트 초기화</h3>
            <p className="text-sm text-gray-500">소싱리스트·주문내역 시트와 헤더를 자동 생성합니다 (최초 1회)</p>
          </div>
        </div>
        {initStatus.message && (
          <p className={`text-sm mb-3 px-3 py-2 rounded-lg ${
            initStatus.status === "success" ? "bg-green-50 text-green-700" :
            initStatus.status === "error" ? "bg-red-50 text-red-700" : "bg-gray-50 text-gray-600"
          }`}>
            {initStatus.message}
          </p>
        )}
        <button
          onClick={handleInitSheets}
          disabled={initStatus.status === "running"}
          className="btn-secondary flex items-center gap-2 w-full justify-center"
        >
          <FileSpreadsheet size={15} />
          {initStatus.status === "running" ? "초기화 중..." : "시트 구조 초기화"}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SyncCard
          title="소싱 리스트 동기화"
          desc="소싱리스트 시트에서 데이터를 불러옵니다"
          state={sourcingSync}
          onSync={() => handleSync("sourcing")}
        />
        <SyncCard
          title="주문 내역 동기화"
          desc="주문내역 시트에서 데이터를 불러옵니다"
          state={ordersSync}
          onSync={() => handleSync("orders")}
        />
      </div>

      <div className="card">
        <h3 className="font-semibold text-gray-900 mb-3">스프레드시트 구조</h3>
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-1">📋 소싱리스트 시트 (탭명: 소싱리스트)</p>
            <p className="text-xs text-gray-500 bg-gray-50 px-3 py-2 rounded-lg font-mono">
              ID | 상품명 | 카테고리 | 브랜드 | 한국구매가(KRW) | 바이마최저가(JPY) | 내판매가(JPY) | 경쟁자수 | 상태 | 환급포함마진율(%) | 환급제외마진율(%) | 배송비(KRW) | 환율 | 메모 | 등록일
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700 mb-1">📦 주문내역 시트 (탭명: 주문내역)</p>
            <p className="text-xs text-gray-500 bg-gray-50 px-3 py-2 rounded-lg font-mono">
              ID | 주문번호 | 상품명 | 구매자명 | 판매가(JPY) | 매입가(KRW) | 배송비(KRW) | 환율 | 상태 | 운송장번호 | 주문일 | 발송일 | 정산일 | 마진(JPY) | 마진율(%) | 메모
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

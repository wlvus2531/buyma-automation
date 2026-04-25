"use client";

import { useState, useRef, useEffect } from "react";
import { X, Upload, FileText, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";
import type { Order } from "@/lib/types";
import { parseBuymaCSV, readFileText } from "@/lib/buyma-csv";
import { formatJpy } from "@/lib/utils";

interface Props {
  existingOrders: Order[];
  onClose: () => void;
  onDone: (added: number) => void;
}

type ImportStatus = "idle" | "importing" | "done" | "error";

export default function CsvUploadModal({ existingOrders, onClose, onDone }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<Order[] | null>(null);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [importStatus, setImportStatus] = useState<ImportStatus>("idle");
  const [importResult, setImportResult] = useState<{ added: number; skipped: number; synced: boolean } | null>(null);
  const [hasScriptUrl, setHasScriptUrl] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    setHasScriptUrl(!!localStorage.getItem("appsScriptUrl"));
  }, []);

  const existingNums = new Set(existingOrders.map(o => o.orderNumber).filter(Boolean));
  const newOrders = parsed?.filter(o => !o.orderNumber || !existingNums.has(o.orderNumber)) ?? [];
  const dupCount = (parsed?.length ?? 0) - newOrders.length;

  async function handleFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setParseErrors(["CSV 파일만 업로드할 수 있습니다"]);
      return;
    }
    setFileName(file.name);
    setParsed(null);
    setParseErrors([]);
    setImportStatus("idle");
    setImportResult(null);

    const text = await readFileText(file);
    const result = parseBuymaCSV(text);
    setParsed(result.orders);
    setParseErrors(result.errors);
  }

  async function handleImport() {
    if (!newOrders.length) return;
    setImportStatus("importing");

    try {
      // 1. API에 배치 저장
      const saveRes = await fetch("/api/sheets/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orders: newOrders }),
      });
      const saveData = await saveRes.json();
      if (!saveRes.ok) throw new Error(saveData.error ?? "저장 실패");

      const added = saveData.added ?? newOrders.length;
      const skipped = saveData.skipped ?? dupCount;

      // 2. Apps Script URL 있으면 자동 동기화
      let synced = false;
      const scriptUrl = localStorage.getItem("appsScriptUrl");
      if (scriptUrl) {
        try {
          const allRes = await fetch("/api/sheets/orders");
          const allData = await allRes.json();
          const syncRes = await fetch("/api/apps-script", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              scriptUrl,
              action: "syncOrders",
              orders: allData.orders ?? [],
            }),
          });
          const syncData = await syncRes.json();
          synced = !syncData.error;
        } catch {
          // 동기화 실패해도 임포트 성공으로 처리
        }
      }

      setImportResult({ added, skipped, synced });
      setImportStatus("done");
      onDone(added);
    } catch (e) {
      setParseErrors([e instanceof Error ? e.message : "가져오기 실패"]);
      setImportStatus("error");
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 shrink-0">
          <h2 className="font-bold text-gray-900 text-lg flex items-center gap-2">
            <Upload size={18} className="text-indigo-600" />
            바이마 CSV 가져오기
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* 본문 */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* 완료 상태 */}
          {importStatus === "done" && importResult && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-1">
              <p className="font-semibold text-green-800 flex items-center gap-2">
                <CheckCircle size={16} /> 가져오기 완료!
              </p>
              <p className="text-sm text-green-700">주문 {importResult.added}건 추가됨 · 중복 {importResult.skipped}건 건너뜀</p>
              {importResult.synced && (
                <p className="text-sm text-green-700 flex items-center gap-1">
                  <RefreshCw size={12} /> 구글시트 동기화 완료
                </p>
              )}
              {!importResult.synced && hasScriptUrl && (
                <p className="text-sm text-yellow-700">구글시트 동기화 실패 (수동 동기화 필요)</p>
              )}
            </div>
          )}

          {/* 파일 드롭 영역 */}
          {importStatus !== "done" && (
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files[0];
                if (f) handleFile(f);
              }}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                dragOver
                  ? "border-indigo-400 bg-indigo-50"
                  : "border-gray-300 hover:border-indigo-400 hover:bg-gray-50"
              }`}
            >
              <FileText size={32} className="mx-auto text-gray-400 mb-2" />
              <p className="text-sm text-gray-700 font-medium">
                {fileName || "CSV 파일을 클릭하거나 드래그하세요"}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                바이마 마이페이지 → 수주관리 → CSV 다운로드
              </p>
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />

          {/* 오류 */}
          {parseErrors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              {parseErrors.map((err, i) => (
                <p key={i} className="text-sm text-red-700 flex items-start gap-2">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" /> {err}
                </p>
              ))}
            </div>
          )}

          {/* 파싱 결과 */}
          {parsed !== null && importStatus !== "done" && (
            <>
              <div className="flex gap-3 flex-wrap">
                <div className="bg-green-50 rounded-lg px-4 py-2 flex items-center gap-2">
                  <CheckCircle size={14} className="text-green-600" />
                  <span className="text-sm text-green-800 font-medium">신규 {newOrders.length}건</span>
                </div>
                {dupCount > 0 && (
                  <div className="bg-yellow-50 rounded-lg px-4 py-2 flex items-center gap-2">
                    <AlertCircle size={14} className="text-yellow-600" />
                    <span className="text-sm text-yellow-800">중복 {dupCount}건 건너뜀</span>
                  </div>
                )}
                {hasScriptUrl && (
                  <div className="bg-blue-50 rounded-lg px-4 py-2 flex items-center gap-2">
                    <RefreshCw size={14} className="text-blue-600" />
                    <span className="text-sm text-blue-800">구글시트 자동 동기화</span>
                  </div>
                )}
              </div>

              {newOrders.length > 0 ? (
                <div className="rounded-xl border border-gray-100 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50">
                        <tr>
                          {["주문번호", "상품명", "구매자", "판매가(JPY)", "상태", "주문일"].map(h => (
                            <th key={h} className="px-3 py-2 text-left text-gray-500 font-medium whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {newOrders.slice(0, 10).map((o, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-3 py-2 font-mono text-gray-500 whitespace-nowrap">{o.orderNumber || "—"}</td>
                            <td className="px-3 py-2 max-w-[150px] truncate text-gray-900">{o.productName || "—"}</td>
                            <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{o.buyerName || "—"}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{o.sellingPrice > 0 ? formatJpy(o.sellingPrice) : "—"}</td>
                            <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{o.status}</td>
                            <td className="px-3 py-2 text-gray-400 whitespace-nowrap">{o.orderDate || "—"}</td>
                          </tr>
                        ))}
                        {newOrders.length > 10 && (
                          <tr>
                            <td colSpan={6} className="px-3 py-2 text-center text-gray-400">
                              외 {newOrders.length - 10}건 더...
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                parsed.length > 0 && (
                  <p className="text-sm text-gray-500 text-center py-4">
                    모든 주문이 이미 등록되어 있습니다 (중복 {dupCount}건)
                  </p>
                )
              )}
            </>
          )}
        </div>

        {/* 하단 버튼 */}
        <div className="flex gap-3 p-5 border-t border-gray-100 shrink-0">
          <button onClick={onClose} className="btn-secondary flex-1">
            {importStatus === "done" ? "닫기" : "취소"}
          </button>
          {importStatus !== "done" && (
            <button
              onClick={handleImport}
              disabled={!newOrders.length || importStatus === "importing"}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {importStatus === "importing" ? (
                <><RefreshCw size={15} className="animate-spin" /> 가져오는 중...</>
              ) : (
                <><Upload size={15} />
                  {newOrders.length > 0
                    ? `${newOrders.length}건 가져오기${hasScriptUrl ? " + 시트 동기화" : ""}`
                    : "가져올 데이터 없음"}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

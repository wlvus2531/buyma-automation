"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Star, Award, UserCheck, ClipboardList, Plus, Trash2,
  Edit2, Save, X, Clock, CheckCircle, AlertCircle,
  Crown, RefreshCw,
} from "lucide-react";
import type { Order, ListingReview, ListingStatus, SellerRating, VipNote } from "@/lib/types";
import clsx from "clsx";

// ─── 파워샵퍼 요건 ────────────────────────────────────────────────────────────

const POWER_REQ = {
  powerShopper: { ratings: 10, score: 4.5, orders: 30, label: "파워샵퍼", color: "text-blue-600", badgeCls: "bg-blue-100 text-blue-700", barCls: "bg-blue-500" },
  premiumPower: { ratings: 30, score: 4.8, orders: 100, label: "프리미엄 파워샵퍼", color: "text-purple-600", badgeCls: "bg-purple-100 text-purple-700", barCls: "bg-purple-500" },
};

const DEFAULT_RATING: SellerRating = { totalRatings: 0, averageScore: 0, fiveStar: 0, fourStar: 0, threeStar: 0, below: 0, orderCount: 0, targetGrade: "powerShopper" };

// ─── 평가 관리 탭 ─────────────────────────────────────────────────────────────

function ProgressBar({ label, current, target, value }: { label: string; current: string; target: string; value: number }) {
  return (
    <div className="mb-3">
      <div className="flex justify-between text-xs text-gray-600 mb-1"><span>{label}</span><span className={value >= 100 ? "text-green-600 font-semibold" : ""}>{current} / {target}{value >= 100 && " ✓"}</span></div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={clsx("h-full rounded-full transition-all", value >= 100 ? "bg-green-500" : value >= 60 ? "bg-indigo-500" : "bg-indigo-400")} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
    </div>
  );
}

function RatingTab({ rating, onSave }: { rating: SellerRating; onSave: (r: SellerRating) => void }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<SellerRating>(rating);
  useEffect(() => setForm(rating), [rating]);

  const target = POWER_REQ[form.targetGrade];
  const ratingProg = Math.min(100, (form.totalRatings / target.ratings) * 100);
  const scoreProg = form.averageScore > 0 ? Math.min(100, (form.averageScore / target.score) * 100) : 0;
  const orderProg = Math.min(100, (form.orderCount / target.orders) * 100);
  const overall = (ratingProg + scoreProg + orderProg) / 3;

  const FIELDS: [keyof SellerRating, string, string, string?][] = [
    ["totalRatings", "총 평가 수", "건"],
    ["averageScore", "평균 별점", "점", "0.1"],
    ["fiveStar", "★5 평가 수", "건"],
    ["fourStar", "★4 평가 수", "건"],
    ["threeStar", "★3 평가 수", "건"],
    ["below", "★1-2 평가 수", "건"],
    ["orderCount", "누적 주문 수", "건"],
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {/* 현재 평가 현황 */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2"><Award size={15} className="text-yellow-500" /> 현재 평가 현황</h3>
            <button onClick={() => setEditing(!editing)} className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1"><Edit2 size={12} /> 수정</button>
          </div>

          {editing ? (
            <div className="space-y-2.5">
              {FIELDS.map(([field, label, unit, step]) => (
                <div key={field} className="flex items-center justify-between gap-2">
                  <label className="text-xs text-gray-600 w-32 shrink-0">{label}</label>
                  <div className="flex items-center gap-1">
                    <input type="number" step={step ?? "1"} min="0" max={field === "averageScore" ? "5" : undefined}
                      value={form[field] as number}
                      onChange={e => setForm(f => ({ ...f, [field]: parseFloat(e.target.value) || 0 }))}
                      className="w-20 border border-gray-300 rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                    <span className="text-xs text-gray-400">{unit}</span>
                  </div>
                </div>
              ))}
              <div className="flex gap-2 pt-2">
                <button onClick={() => { onSave(form); setEditing(false); }} className="flex-1 bg-indigo-600 text-white text-sm py-1.5 rounded-lg hover:bg-indigo-700 flex items-center justify-center gap-1"><Save size={13} /> 저장</button>
                <button onClick={() => { setForm(rating); setEditing(false); }} className="px-3 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">취소</button>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2 mb-2">
                {[1, 2, 3, 4, 5].map(s => <Star key={s} size={20} className={s <= Math.floor(form.averageScore) ? "fill-yellow-400 text-yellow-400" : "text-gray-200"} />)}
                <span className="font-bold text-gray-900 text-2xl ml-1">{form.averageScore.toFixed(1)}</span>
              </div>
              <p className="text-sm text-gray-500 mb-3">총 {form.totalRatings}건 평가 · 누적 주문 {form.orderCount}건</p>
              <div className="space-y-1.5">
                {[{ star: "★★★★★", count: form.fiveStar }, { star: "★★★★", count: form.fourStar }, { star: "★★★", count: form.threeStar }, { star: "★★ 이하", count: form.below }].map(({ star, count }) => (
                  <div key={star} className="flex items-center gap-2 text-xs">
                    <span className="text-yellow-500 w-16 shrink-0">{star}</span>
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full">
                      <div className="h-full bg-yellow-400 rounded-full" style={{ width: form.totalRatings > 0 ? `${(count / form.totalRatings) * 100}%` : "0%" }} />
                    </div>
                    <span className="text-gray-400 w-6 text-right">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 파워샵퍼 달성 진행률 */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2"><Crown size={15} className="text-purple-500" /> 파워샵퍼 달성 진행률</h3>
            <select value={form.targetGrade} onChange={e => { const updated = { ...form, targetGrade: e.target.value as SellerRating["targetGrade"] }; setForm(updated); onSave(updated); }}
              className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-300">
              <option value="powerShopper">파워샵퍼</option>
              <option value="premiumPower">프리미엄 파워샵퍼</option>
            </select>
          </div>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className={clsx("text-sm font-bold", target.color)}>전체 달성률 {overall.toFixed(0)}%</span>
              <span className={clsx("text-xs px-2 py-0.5 rounded-full font-medium", target.badgeCls)}>{target.label}</span>
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <div className={clsx("h-full rounded-full transition-all", overall >= 100 ? "bg-green-500" : target.barCls)} style={{ width: `${Math.min(overall, 100)}%` }} />
            </div>
          </div>

          <ProgressBar label="평가 수" current={`${form.totalRatings}건`} target={`${target.ratings}건`} value={ratingProg} />
          <ProgressBar label="평균 별점" current={`${form.averageScore.toFixed(1)}점`} target={`${target.score}점`} value={scoreProg} />
          <ProgressBar label="누적 주문 수" current={`${form.orderCount}건`} target={`${target.orders}건`} value={orderProg} />
          <p className="text-xs text-gray-400 mt-3">* 바이마 공식 요건과 다를 수 있습니다 (참고용)</p>
        </div>
      </div>
    </div>
  );
}

// ─── 출품 심사 탭 ─────────────────────────────────────────────────────────────

const STATUS_INFO: Record<ListingStatus, { cls: string; icon: React.ReactNode }> = {
  "심사중": { cls: "bg-yellow-100 text-yellow-700", icon: <Clock size={11} /> },
  "승인": { cls: "bg-green-100 text-green-700", icon: <CheckCircle size={11} /> },
  "거절": { cls: "bg-red-100 text-red-700", icon: <X size={11} /> },
  "수정요청": { cls: "bg-orange-100 text-orange-700", icon: <AlertCircle size={11} /> },
};

const BLANK_FORM = { productName: "", brand: "", submittedDate: "", status: "심사중" as ListingStatus, notes: "" };

function ListingTab({ listings, onSave }: { listings: ListingReview[]; onSave: (l: ListingReview[]) => void }) {
  const today = new Date().toISOString().split("T")[0];
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...BLANK_FORM, submittedDate: today });
  const [editId, setEditId] = useState<string | null>(null);

  function submit() {
    if (!form.productName.trim()) return;
    if (editId) onSave(listings.map(l => l.id === editId ? { ...l, ...form } : l));
    else onSave([...listings, { id: Date.now().toString(), ...form }]);
    setForm({ ...BLANK_FORM, submittedDate: today });
    setShowForm(false); setEditId(null);
  }

  function startEdit(l: ListingReview) {
    setForm({ productName: l.productName, brand: l.brand, submittedDate: l.submittedDate, status: l.status, notes: l.notes });
    setEditId(l.id); setShowForm(true);
  }

  function daysPassed(d: string) { return Math.floor((Date.now() - new Date(d).getTime()) / 86400000); }

  const pending = listings.filter(l => l.status === "심사중");

  const COUNTS: [ListingStatus, string][] = [["심사중", "text-yellow-600"], ["승인", "text-green-600"], ["거절", "text-red-600"], ["수정요청", "text-orange-600"]];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        {COUNTS.map(([s, color]) => (
          <div key={s} className="bg-white border border-gray-200 rounded-xl p-3 text-center">
            <div className={clsx("text-2xl font-bold", color)}>{listings.filter(l => l.status === s).length}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s}</div>
          </div>
        ))}
      </div>

      {pending.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
          <div className="flex items-center gap-2 text-yellow-700 font-medium text-sm mb-2"><Clock size={13} /> 심사 중인 상품 ({pending.length}개) — 평균 3~5일 소요</div>
          <div className="space-y-1">
            {pending.map(l => {
              const d = daysPassed(l.submittedDate);
              return (
                <div key={l.id} className="flex items-center justify-between text-xs">
                  <span className="text-yellow-800">{l.productName}{l.brand ? ` (${l.brand})` : ""}</span>
                  <span className={clsx("font-medium", d > 5 ? "text-red-600" : d >= 3 ? "text-yellow-600" : "text-gray-500")}>
                    {d}일 경과{d > 5 ? " ⚠️ 지연" : d >= 3 ? " (완료 예상)" : ""}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2"><ClipboardList size={15} className="text-blue-500" /> 출품 심사 이력</h3>
        <button onClick={() => { setShowForm(!showForm); setEditId(null); setForm({ ...BLANK_FORM, submittedDate: today }); }}
          className="bg-indigo-600 text-white text-sm px-3 py-1.5 rounded-lg hover:bg-indigo-700 flex items-center gap-1">
          <Plus size={14} /> 추가
        </button>
      </div>

      {showForm && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
          <h4 className="font-medium text-indigo-800 mb-3">{editId ? "심사 이력 수정" : "새 출품 심사 등록"}</h4>
          <div className="grid grid-cols-2 gap-3 mb-3">
            {[["상품명 *", "productName", "text", "상품명 입력"], ["브랜드", "brand", "text", "브랜드명"], ["제출일", "submittedDate", "date", ""], ["", "", "", ""]].map(([label, field, type, placeholder], i) => (
              field ? (
                <div key={i}>
                  <label className="text-xs text-gray-600 mb-1 block">{label}</label>
                  <input type={type} value={(form as Record<string, string>)[field]} placeholder={placeholder}
                    onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                </div>
              ) : (
                <div key={i}>
                  <label className="text-xs text-gray-600 mb-1 block">상태</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as ListingStatus }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                    {(["심사중", "승인", "거절", "수정요청"] as ListingStatus[]).map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              )
            ))}
          </div>
          <div className="mb-3">
            <label className="text-xs text-gray-600 mb-1 block">메모</label>
            <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" placeholder="거절 사유, 수정 내용 등" />
          </div>
          <div className="flex gap-2">
            <button onClick={submit} className="bg-indigo-600 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-indigo-700 flex items-center gap-1"><Save size={13} /> {editId ? "수정" : "등록"}</button>
            <button onClick={() => { setShowForm(false); setEditId(null); }} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">취소</button>
          </div>
        </div>
      )}

      {listings.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-200 rounded-xl p-8 text-center text-gray-400 text-sm">출품 심사 이력이 없습니다. 위 버튼으로 추가해 주세요.</div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left p-3 font-medium text-gray-600">상품명</th>
                <th className="text-left p-3 font-medium text-gray-600">브랜드</th>
                <th className="text-center p-3 font-medium text-gray-600">제출일</th>
                <th className="text-center p-3 font-medium text-gray-600">경과</th>
                <th className="text-center p-3 font-medium text-gray-600">상태</th>
                <th className="text-left p-3 font-medium text-gray-600">메모</th>
                <th className="p-3 w-16" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {[...listings].sort((a, b) => b.submittedDate.localeCompare(a.submittedDate)).map(l => {
                const d = daysPassed(l.submittedDate);
                const info = STATUS_INFO[l.status];
                return (
                  <tr key={l.id} className="hover:bg-gray-50">
                    <td className="p-3 font-medium text-gray-800">{l.productName}</td>
                    <td className="p-3 text-gray-500 text-xs">{l.brand || "-"}</td>
                    <td className="p-3 text-center text-gray-500 text-xs">{l.submittedDate}</td>
                    <td className="p-3 text-center">
                      <span className={clsx("text-xs font-medium", l.status === "심사중" && d > 5 ? "text-red-600" : "text-gray-500")}>{d}일</span>
                    </td>
                    <td className="p-3 text-center">
                      <span className={clsx("text-xs px-2 py-0.5 rounded-full flex items-center justify-center gap-0.5 w-fit mx-auto", info.cls)}>{info.icon} {l.status}</span>
                    </td>
                    <td className="p-3 text-xs text-gray-400 max-w-xs truncate">{l.notes || "-"}</td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        <button onClick={() => startEdit(l)} className="p-1 text-gray-400 hover:text-indigo-600"><Edit2 size={13} /></button>
                        <button onClick={() => onSave(listings.filter(x => x.id !== l.id))} className="p-1 text-gray-400 hover:text-red-500"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── 리피터 고객 탭 ───────────────────────────────────────────────────────────

function CustomersTab({ orders, vipNotes, onSaveVip }: { orders: Order[]; vipNotes: Record<string, VipNote>; onSaveVip: (v: Record<string, VipNote>) => void }) {
  const [editingName, setEditingName] = useState<string | null>(null);
  const [noteForm, setNoteForm] = useState<VipNote>({ isVip: false, note: "" });

  const repeaters = useMemo(() => {
    const map: Record<string, { name: string; count: number; totalJpy: number; lastDate: string }> = {};
    for (const o of orders) {
      if (!o.buyerName) continue;
      if (!map[o.buyerName]) map[o.buyerName] = { name: o.buyerName, count: 0, totalJpy: 0, lastDate: "" };
      map[o.buyerName].count++;
      map[o.buyerName].totalJpy += o.sellingPrice || 0;
      if (o.orderDate > (map[o.buyerName].lastDate || "")) map[o.buyerName].lastDate = o.orderDate;
    }
    return Object.values(map).filter(c => c.count >= 2).sort((a, b) => b.count - a.count);
  }, [orders]);

  function saveNote() {
    if (!editingName) return;
    onSaveVip({ ...vipNotes, [editingName]: noteForm });
    setEditingName(null);
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "리피터 고객", count: repeaters.length, color: "text-indigo-600" },
          { label: "VIP 고객", count: repeaters.filter(c => vipNotes[c.name]?.isVip).length, color: "text-yellow-600" },
          { label: "최다 구매 횟수", count: repeaters[0]?.count ?? 0, color: "text-green-600", suffix: "회" },
        ].map(({ label, count, color, suffix }) => (
          <div key={label} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className={clsx("text-2xl font-bold", color)}>{count}{suffix}</div>
            <div className="text-sm text-gray-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">
        <UserCheck size={13} className="inline mr-1" /> 동일 구매자명으로 2건 이상 주문된 고객이 자동으로 표시됩니다.
      </div>

      {repeaters.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-200 rounded-xl p-8 text-center">
          <div className="text-gray-400 text-sm">아직 2회 이상 구매한 고객이 없습니다</div>
          <div className="text-gray-300 text-xs mt-1">주문이 쌓이면 자동으로 표시됩니다</div>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left p-3 font-medium text-gray-600">구매자명</th>
                <th className="text-center p-3 font-medium text-gray-600">구매 횟수</th>
                <th className="text-right p-3 font-medium text-gray-600">총 구매액</th>
                <th className="text-center p-3 font-medium text-gray-600">최근 구매일</th>
                <th className="text-center p-3 font-medium text-gray-600">VIP</th>
                <th className="text-left p-3 font-medium text-gray-600">메모</th>
                <th className="p-3 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {repeaters.map(c => {
                const vip = vipNotes[c.name];
                const isEditing = editingName === c.name;
                return (
                  <tr key={c.name} className="hover:bg-gray-50">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        {vip?.isVip && <Crown size={13} className="text-yellow-500 shrink-0" />}
                        <span className="font-medium text-gray-800">{c.name}</span>
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      <span className={clsx("font-bold", c.count >= 5 ? "text-purple-600" : c.count >= 3 ? "text-blue-600" : "text-gray-700")}>{c.count}회</span>
                    </td>
                    <td className="p-3 text-right font-medium text-gray-700">¥{c.totalJpy.toLocaleString()}</td>
                    <td className="p-3 text-center text-gray-500 text-xs">{c.lastDate || "-"}</td>
                    <td className="p-3 text-center">
                      {vip?.isVip ? <span className="bg-yellow-100 text-yellow-700 text-xs px-2 py-0.5 rounded-full">VIP</span> : <span className="text-gray-300 text-xs">-</span>}
                    </td>
                    <td className="p-3 text-xs min-w-0">
                      {isEditing ? (
                        <div className="flex gap-2 items-center">
                          <label className="flex items-center gap-1 text-xs cursor-pointer shrink-0">
                            <input type="checkbox" checked={noteForm.isVip} onChange={e => setNoteForm(f => ({ ...f, isVip: e.target.checked }))} /> VIP
                          </label>
                          <input value={noteForm.note} onChange={e => setNoteForm(f => ({ ...f, note: e.target.value }))}
                            className="flex-1 border border-gray-300 rounded px-2 py-0.5 text-xs min-w-0" placeholder="메모 입력" />
                          <button onClick={saveNote} className="text-indigo-600 hover:text-indigo-800 shrink-0"><Save size={12} /></button>
                          <button onClick={() => setEditingName(null)} className="text-gray-400 shrink-0"><X size={12} /></button>
                        </div>
                      ) : (
                        <span className="text-gray-400">{vip?.note || "-"}</span>
                      )}
                    </td>
                    <td className="p-3">
                      {!isEditing && (
                        <button onClick={() => { setEditingName(c.name); setNoteForm(vipNotes[c.name] ?? { isVip: false, note: "" }); }} className="p-1 text-gray-400 hover:text-indigo-600">
                          <Edit2 size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── 메인 페이지 ──────────────────────────────────────────────────────────────

type Tab = "rating" | "listing" | "customers";

export default function SellerPage() {
  const [tab, setTab] = useState<Tab>("rating");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState<SellerRating>(DEFAULT_RATING);
  const [listings, setListings] = useState<ListingReview[]>([]);
  const [vipNotes, setVipNotes] = useState<Record<string, VipNote>>({});

  useEffect(() => {
    fetch("/api/sheets/orders").then(r => r.json()).then(d => setOrders(d.orders ?? [])).finally(() => setLoading(false));
    try {
      const r = localStorage.getItem("buyma-rating");
      const l = localStorage.getItem("buyma-listings");
      const v = localStorage.getItem("buyma-vip-notes");
      if (r) setRating(JSON.parse(r));
      if (l) setListings(JSON.parse(l));
      if (v) setVipNotes(JSON.parse(v));
    } catch { /* ignore */ }
  }, []);

  function saveRating(r: SellerRating) { setRating(r); localStorage.setItem("buyma-rating", JSON.stringify(r)); }
  function saveListings(l: ListingReview[]) { setListings(l); localStorage.setItem("buyma-listings", JSON.stringify(l)); }
  function saveVipNotes(v: Record<string, VipNote>) { setVipNotes(v); localStorage.setItem("buyma-vip-notes", JSON.stringify(v)); }

  if (loading) {
    return <div className="p-8 flex items-center justify-center text-gray-400"><RefreshCw size={16} className="animate-spin mr-2" /> 데이터 불러오는 중...</div>;
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">셀러 관리</h1>
        <p className="text-sm text-gray-500 mt-1">평가 관리 · 출품 심사 추적 · 리피터 고객 관리</p>
      </div>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg mb-6 w-fit">
        {([["rating", "⭐ 평가 관리"], ["listing", "📋 출품 심사"], ["customers", "👤 리피터 고객"]] as [Tab, string][]).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} className={clsx("px-4 py-2 rounded-md text-sm font-medium transition-all", tab === t ? "bg-white shadow-sm text-indigo-700" : "text-gray-600 hover:text-gray-900")}>{label}</button>
        ))}
      </div>

      {tab === "rating" && <RatingTab rating={rating} onSave={saveRating} />}
      {tab === "listing" && <ListingTab listings={listings} onSave={saveListings} />}
      {tab === "customers" && <CustomersTab orders={orders} vipNotes={vipNotes} onSaveVip={saveVipNotes} />}
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createBrowserSupabase, getCurrentUserId } from "@/lib/supabase";
import type { User } from "@/types";
import clsx from "clsx";

const PRIMARY_NAV = [
  { href: "/today",     label: "오늘 할 일",  emoji: "🏠" },
  { href: "/products",  label: "AI 상품",     emoji: "🤖" },
  { href: "/register",  label: "등록 워크플로우", emoji: "📦" },
  { href: "/orders",    label: "주문/발주",   emoji: "🛒" },
  { href: "/monitor",   label: "모니터링",    emoji: "🔔" },
  { href: "/cs",        label: "CS",          emoji: "💬" },
];

const TOOLS_NAV = [
  { href: "/calculator",   label: "마진 계산기" },
  { href: "/ai-sourcing",  label: "AI 소싱 전략" },
  { href: "/sourcing",     label: "소싱 리스트" },
  { href: "/japan-helper", label: "일본어 도우미" },
  { href: "/thumbnail",    label: "썸네일 생성" },
  { href: "/sync",         label: "구글시트 동기화" },
  { href: "/seller",       label: "셀러 관리" },
  { href: "/analytics",    label: "판매 분석" },
  { href: "/dashboard",    label: "구 대시보드" },
];

export default function Navigation() {
  const pathname = usePathname();
  const [me, setMe] = useState<User | null>(null);
  const [toolsOpen, setToolsOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const supabase = createBrowserSupabase();
        let userId = await getCurrentUserId();
        if (!userId) {
          const { data } = await supabase.from("users").select("*").eq("role", "operator").limit(1).maybeSingle();
          if (data) {
            if (typeof window !== "undefined") localStorage.setItem("current_user_id", data.id);
            userId = data.id;
          }
        }
        if (userId) {
          const { data } = await supabase.from("users").select("*").eq("id", userId).maybeSingle();
          if (data) setMe(data as User);
        }
      } catch (e) {
        console.warn('[Navigation] user load failed:', e);
      }
    })();
  }, []);

  return (
    <header className="bg-white border-b border-stone-200 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center gap-6">
        <Link href="/today" className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center font-bold" style={{ fontFamily: "'Times New Roman', Georgia, serif", fontSize: '18px' }}>B</div>
          <div className="hidden sm:block">
            <div className="text-sm font-semibold text-stone-900 leading-none" style={{ fontFamily: "'Times New Roman', Georgia, serif" }}>ModanK.</div>
            <div className="text-[10px] text-stone-500 mt-0.5">바이마 운영 v3.1</div>
          </div>
        </Link>

        <nav className="flex items-center gap-1 flex-1 overflow-x-auto">
          {PRIMARY_NAV.map(({ href, label, emoji }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
                  active ? "bg-stone-900 text-white" : "text-stone-600 hover:bg-stone-100"
                )}
              >
                <span className="mr-1.5">{emoji}</span>{label}
              </Link>
            );
          })}

          {/* 도구 드롭다운 */}
          <div
            className="relative"
            onMouseLeave={() => setToolsOpen(false)}
          >
            <button
              onMouseEnter={() => setToolsOpen(true)}
              onClick={() => setToolsOpen((v) => !v)}
              className={clsx(
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
                TOOLS_NAV.some((t) => pathname === t.href)
                  ? "bg-stone-900 text-white"
                  : "text-stone-600 hover:bg-stone-100"
              )}
            >
              🛠 도구 ▾
            </button>
            {toolsOpen && (
              <div className="absolute left-0 top-full mt-1 w-48 bg-white border border-stone-200 rounded-xl shadow-lg py-1 z-40">
                {TOOLS_NAV.map(({ href, label }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setToolsOpen(false)}
                    className={clsx(
                      "block px-3 py-2 text-sm hover:bg-stone-100",
                      pathname === href ? "font-semibold text-stone-900" : "text-stone-600"
                    )}
                  >
                    {label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </nav>

        {/* 사용자 표시 */}
        {me && (
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded-full bg-stone-200 flex items-center justify-center text-sm">
              {me.avatar_emoji}
            </div>
            <div className="hidden md:block">
              <div className="text-xs font-medium text-stone-900 leading-tight">{me.name}</div>
              <div className="text-[10px] text-stone-500 leading-tight">
                {me.role === "owner" ? "사장님" : "운영자"}
              </div>
            </div>
            {me.role === "owner" && (
              <span className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold">OWNER</span>
            )}
          </div>
        )}
      </div>
    </header>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Sparkles,
  List,
  Calculator,
  ShoppingCart,
  Image as ImageIcon,
  RefreshCw,
  BarChart2,
  UserCheck,
  Bot,
  ClipboardList,
} from "lucide-react";
import clsx from "clsx";

const navItems = [
  { href: "/", label: "대시보드", icon: LayoutDashboard },
  { href: "/products", label: "AI 소싱 상품", icon: Bot },
  { href: "/register", label: "등록 워크플로우", icon: ClipboardList },
  { href: "/ai-sourcing", label: "AI 소싱 전략", icon: Sparkles },
  { href: "/sourcing", label: "소싱 리스트", icon: List },
  { href: "/calculator", label: "마진 계산기", icon: Calculator },
  { href: "/orders", label: "주문 관리", icon: ShoppingCart },
  { href: "/analytics", label: "판매 분석", icon: BarChart2 },
  { href: "/seller", label: "셀러 관리", icon: UserCheck },
  { href: "/thumbnail", label: "썸네일 생성", icon: ImageIcon },
  { href: "/sync", label: "구글시트 동기화", icon: RefreshCw },
];

export default function Navigation() {
  const pathname = usePathname();

  return (
    <aside className="w-60 bg-white border-r border-gray-200 flex flex-col h-screen sticky top-0">
      <div className="p-5 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">B</span>
          </div>
          <div>
            <p className="font-bold text-gray-900 text-sm leading-tight">바이마 자동화</p>
            <p className="text-xs text-gray-400">한국→일본 역직구</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <Icon size={18} className={active ? "text-indigo-600" : "text-gray-400"} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-100">
        <p className="text-xs text-gray-400 text-center">바이마 올인원 v1.0</p>
      </div>
    </aside>
  );
}

import type { Metadata } from "next";
import "./globals.css";
import NavigationGate from "@/components/NavigationGate";
import LayoutMain from "@/components/LayoutMain";

export const metadata: Metadata = {
  title: "바이마 운영 v3.1",
  description: "BUYMA 한국→일본 역직구 — 실시간 협업 + 양방향 승인",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="bg-stone-100 min-h-screen">
        <NavigationGate />
        <LayoutMain>{children}</LayoutMain>
      </body>
    </html>
  );
}

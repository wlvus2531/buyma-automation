import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: '바이마 사장님',
  description: '1초 승인 + 운영 현황',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: '바이마 사장님',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#1c1917',
};

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-stone-50">{children}</div>;
}

'use client';

import { usePathname } from 'next/navigation';

/**
 * /owner 경로는 max-w 컨테이너 없이 풀폭으로 (모바일 PWA)
 * 그 외는 max-w-7xl 컨테이너 적용
 */
export default function LayoutMain({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isOwner = pathname.startsWith('/owner');
  return (
    <main className={isOwner ? '' : 'max-w-7xl mx-auto px-6 py-8'}>
      {children}
    </main>
  );
}

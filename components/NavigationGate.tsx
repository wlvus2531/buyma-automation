'use client';

import { usePathname } from 'next/navigation';
import Navigation from './Navigation';

/**
 * /owner 경로(사장님 모바일 PWA)에서는 데스크톱 nav를 숨김.
 * 그 외 경로에서는 정상 표시.
 */
export default function NavigationGate() {
  const pathname = usePathname();
  if (pathname.startsWith('/owner')) return null;
  return <Navigation />;
}

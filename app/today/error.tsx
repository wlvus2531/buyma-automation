'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[/today] error boundary:', error);
  }, [error]);

  return (
    <div className="rounded-2xl border-2 border-red-300 bg-red-50 p-6 max-w-3xl mx-auto mt-8">
      <div className="font-bold text-red-900 text-lg mb-2">⚠️ /today 페이지 에러</div>
      <div className="text-sm font-mono text-red-800 mb-2 break-all">
        {error.message}
      </div>
      {error.digest && (
        <div className="text-[11px] text-red-600 mb-3">digest: {error.digest}</div>
      )}
      {error.stack && (
        <details className="mb-3">
          <summary className="text-xs text-red-700 cursor-pointer">스택 트레이스</summary>
          <pre className="mt-2 text-[10px] bg-white p-2 rounded overflow-x-auto whitespace-pre-wrap text-stone-700">
            {error.stack}
          </pre>
        </details>
      )}
      <div className="flex gap-2">
        <button
          onClick={() => reset()}
          className="bg-stone-900 text-white text-sm px-4 py-2 rounded-lg"
        >
          다시 시도
        </button>
        <button
          onClick={() => {
            if (typeof window !== 'undefined') {
              localStorage.clear();
              location.reload();
            }
          }}
          className="border border-stone-300 text-sm px-4 py-2 rounded-lg"
        >
          캐시 초기화 + 새로고침
        </button>
      </div>
    </div>
  );
}

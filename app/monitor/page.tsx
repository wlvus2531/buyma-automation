/**
 * /monitor — 경쟁자 가격 모니터링 대시보드
 * Chrome 확장 V1이 수집한 BUYMA 경쟁자 데이터 확인
 */

'use client';

import { useEffect, useState, useCallback } from 'react';

interface CompetitorItem {
  id: string;
  buyma_item_id: string | null;
  buyma_url: string | null;
  item_name: string | null;
  brand: string | null;
  seller_name: string | null;
  seller_rating: number | null;
  price_jpy: number | null;
  prev_price_jpy: number | null;
  is_in_stock: boolean;
  image_url: string | null;
  rank_position: number | null;
  search_keyword: string | null;
  page_type: string;
  is_alert: boolean;
  alert_reason: string | null;
  captured_at: string;
}

type Tab = 'alerts' | 'all';

export default function MonitorPage() {
  const [tab, setTab]           = useState<Tab>('alerts');
  const [items, setItems]       = useState<CompetitorItem[]>([]);
  const [stats, setStats]       = useState({ total: 0, alerts: 0, sellers: 0 });
  const [keyword, setKeyword]   = useState('');
  const [loading, setLoading]   = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ tab, limit: '100' });
      if (keyword) params.set('keyword', keyword);
      const [listRes, summaryRes] = await Promise.all([
        fetch(`/api/monitor/list?${params}`),
        fetch('/api/monitor/list?summary=true'),
      ]);
      const listData    = await listRes.json();
      const summaryData = await summaryRes.json();
      setItems(listData.items || []);
      setStats({ total: summaryData.total || 0, alerts: summaryData.alerts || 0, sellers: summaryData.sellers || 0 });
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [tab, keyword]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      {/* 페이지 헤더 */}
      <div className="mb-6 flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-stone-500 mb-1">실시간 모니터링</p>
          <h1 className="text-3xl font-bold text-stone-900">경쟁자 가격 모니터링</h1>
        </div>
        <div className="flex items-center gap-3">
          <ExtensionInstallBadge />
          <button
            onClick={load}
            className="border border-stone-300 hover:bg-stone-100 px-3 py-1.5 rounded-lg text-sm"
          >
            새로고침
          </button>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="오늘 수집" value={stats.total} />
        <StatCard label="경쟁 셀러" value={stats.sellers} />
        <StatCard label="알림" value={stats.alerts} highlight={stats.alerts > 0} />
      </div>

      {/* 탭 + 검색 */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex rounded-lg border border-stone-200 overflow-hidden">
          {(['alerts', 'all'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                tab === t ? 'bg-stone-900 text-white' : 'bg-white text-stone-600 hover:bg-stone-50'
              }`}
            >
              {t === 'alerts' ? `⚠️ 알림 (${stats.alerts})` : '전체'}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          placeholder="키워드 검색..."
          className="border border-stone-200 rounded-lg px-3 py-1.5 text-sm w-44 focus:outline-none focus:border-stone-400"
        />
      </div>

      {/* 컨텐츠 */}
      {loading ? (
        <div className="text-center text-stone-500 py-20">불러오는 중...</div>
      ) : items.length === 0 ? (
        <EmptyState tab={tab} />
      ) : (
        <div className="rounded-2xl border border-stone-200 overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 border-b border-stone-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-stone-600">상품명</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">셀러</th>
                <th className="text-right px-4 py-3 font-medium text-stone-600">가격 (JPY)</th>
                <th className="text-center px-4 py-3 font-medium text-stone-600">순위</th>
                <th className="text-center px-4 py-3 font-medium text-stone-600">재고</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">알림</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">수집 시각</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {items.map(item => (
                <ItemRow key={item.id} item={item} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 확장 설치 안내 */}
      <InstallGuide />
    </div>
  );
}

// ──────────────────────────────────────────────
// 서브 컴포넌트
// ──────────────────────────────────────────────

function StatCard({ label, value, highlight = false }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className="bg-white rounded-2xl border border-stone-200 p-5">
      <div className={`text-3xl font-bold mb-1 ${highlight ? 'text-red-600' : 'text-stone-900'}`}>
        {value}
      </div>
      <div className="text-sm text-stone-500">{label}</div>
    </div>
  );
}

function ItemRow({ item }: { item: CompetitorItem }) {
  const priceChanged = item.prev_price_jpy && item.price_jpy && item.prev_price_jpy !== item.price_jpy;
  const priceDown    = priceChanged && item.price_jpy! < item.prev_price_jpy!;
  const timeAgo = item.captured_at
    ? (() => {
        const diff = (Date.now() - new Date(item.captured_at).getTime()) / 60000;
        if (diff < 60) return `${Math.floor(diff)}분 전`;
        if (diff < 1440) return `${Math.floor(diff / 60)}시간 전`;
        return `${Math.floor(diff / 1440)}일 전`;
      })()
    : '';

  return (
    <tr className={item.is_alert ? 'bg-red-50/30' : ''}>
      <td className="px-4 py-3">
        <div className="font-medium text-stone-900 max-w-[200px] truncate">
          {item.buyma_url ? (
            <a href={item.buyma_url} target="_blank" rel="noopener" className="hover:underline">
              {item.item_name || item.buyma_item_id || '-'}
            </a>
          ) : (
            item.item_name || item.buyma_item_id || '-'
          )}
        </div>
        {item.search_keyword && (
          <div className="text-xs text-stone-400 mt-0.5">"{item.search_keyword}"</div>
        )}
      </td>
      <td className="px-4 py-3 text-stone-600">{item.seller_name || '-'}</td>
      <td className="px-4 py-3 text-right">
        {item.price_jpy ? (
          <span className="font-semibold text-stone-900">
            ¥{item.price_jpy.toLocaleString()}
          </span>
        ) : '-'}
        {priceChanged && item.prev_price_jpy && (
          <div className={`text-xs mt-0.5 ${priceDown ? 'text-emerald-600' : 'text-red-600'}`}>
            {priceDown ? '↓' : '↑'} ¥{item.prev_price_jpy.toLocaleString()}
          </div>
        )}
      </td>
      <td className="px-4 py-3 text-center text-stone-600">
        {item.rank_position ? `#${item.rank_position}` : '-'}
      </td>
      <td className="px-4 py-3 text-center">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
          item.is_in_stock
            ? 'bg-emerald-100 text-emerald-700'
            : 'bg-stone-100 text-stone-500'
        }`}>
          {item.is_in_stock ? '있음' : '품절'}
        </span>
      </td>
      <td className="px-4 py-3">
        {item.is_alert && item.alert_reason ? (
          <span className="text-xs text-red-700 max-w-[160px] block truncate" title={item.alert_reason}>
            ⚠️ {item.alert_reason}
          </span>
        ) : '-'}
      </td>
      <td className="px-4 py-3 text-xs text-stone-400">{timeAgo}</td>
    </tr>
  );
}

function ExtensionInstallBadge() {
  return (
    <span className="text-xs bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full font-medium">
      Chrome 확장 필요
    </span>
  );
}

function EmptyState({ tab }: { tab: Tab }) {
  return (
    <div className="text-center py-20 text-stone-500">
      <div className="text-5xl mb-4">📡</div>
      <div className="font-medium text-stone-700 mb-2">
        {tab === 'alerts' ? '알림이 없습니다' : '수집된 데이터가 없습니다'}
      </div>
      <p className="text-sm">
        Chrome 확장을 설치하고 BUYMA에서 검색하면 자동 수집됩니다.
      </p>
    </div>
  );
}

function InstallGuide() {
  return (
    <div className="mt-8 rounded-2xl border border-stone-200 bg-white p-6">
      <h2 className="font-bold text-stone-900 mb-4 flex items-center gap-2">
        <span className="text-xl">🔌</span> Chrome 확장 설치 방법
      </h2>
      <ol className="space-y-3 text-sm text-stone-700">
        <li className="flex gap-3">
          <span className="w-6 h-6 rounded-full bg-stone-900 text-white text-xs flex items-center justify-center shrink-0 mt-0.5">1</span>
          <span>프로젝트의 <code className="bg-stone-100 px-1.5 py-0.5 rounded text-stone-800">chrome-extension/</code> 폴더를 로컬에 다운로드합니다.</span>
        </li>
        <li className="flex gap-3">
          <span className="w-6 h-6 rounded-full bg-stone-900 text-white text-xs flex items-center justify-center shrink-0 mt-0.5">2</span>
          <span>Chrome 주소창에 <code className="bg-stone-100 px-1.5 py-0.5 rounded text-stone-800">chrome://extensions</code> 입력 → 우측 상단 "개발자 모드" 활성화</span>
        </li>
        <li className="flex gap-3">
          <span className="w-6 h-6 rounded-full bg-stone-900 text-white text-xs flex items-center justify-center shrink-0 mt-0.5">3</span>
          <span>"압축해제된 확장 프로그램 로드" 클릭 → <code className="bg-stone-100 px-1.5 py-0.5 rounded text-stone-800">chrome-extension</code> 폴더 선택</span>
        </li>
        <li className="flex gap-3">
          <span className="w-6 h-6 rounded-full bg-stone-900 text-white text-xs flex items-center justify-center shrink-0 mt-0.5">4</span>
          <span>BUYMA에서 경쟁 상품 검색 → 자동으로 가격/순위 수집 시작</span>
        </li>
      </ol>
      <div className="mt-4 text-xs text-stone-500 bg-stone-50 rounded-lg p-3">
        수집된 데이터는 실시간으로 이 대시보드에 표시됩니다. 가격 변동 5% 이상이거나 우리 판매가와 차이가 ¥500 이하면 알림이 생성됩니다.
      </div>
    </div>
  );
}

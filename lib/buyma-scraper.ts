/**
 * 바이마 서버사이드 스크래퍼 — v4 P1 (실측 검증 완료 2026-07-19)
 *
 * 검증된 사실:
 * - 리스트/상세 페이지 모두 서버 렌더링 → 일반 HTTP 요청으로 수집 가능
 * - 리스트 카드 속성에 syo_id/syo_name/brand_name/category/price 포함
 * - 상세 페이지 .ac_count = 조회수, .fav_count = 찜 수
 * - 이미지 URL의 /imgdata/item/YYMMDD/ = 실제 등록일 (V1 기법, 리스트·상세 공통)
 *   (인기순 리스트에서 80개 중 73가지 날짜 분포 확인 → 등록일 맞음)
 * - 정렬 코드: O1=인기순(기본) O2=신착순 O3=저가순
 */

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

export async function fetchBuymaHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'ja,en;q=0.8' },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`BUYMA fetch ${res.status}: ${url}`);
  return res.text();
}

export interface BuymaListItem {
  buyma_item_id: string;
  buyma_url: string;
  name_jp: string | null;
  brand: string | null;
  category: string | null;
  price_jpy: number | null;
  seller_id: string | null;
  seller_name: string | null;
  seller_type: string | null; // normal | premium
  rank_position: number;
  image_url: string | null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&#x27;/g, "'");
}

/** 검색/카테고리 리스트 페이지 파싱 */
export function parseListPage(html: string): BuymaListItem[] {
  const blocks = html.split(/<li item-id="/).slice(1);
  const items: BuymaListItem[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const id = block.match(/^(\d+)/)?.[1];
    if (!id) continue;

    const attr = (name: string) =>
      block.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? null;

    const name = attr('syo_name');
    const brand = attr('brand_name');
    const category = attr('category');
    const priceRaw = attr('price');
    const img = block.match(/src="(https:\/\/[^"]*imgdata\/item\/[^"]+)"/)?.[1] ?? null;

    const buyer = block.match(/href="\/buyer\/(\d+)\.html"[^>]*>([^<]+)</);
    const shopperStatus = block.match(/product_shopper_status">([^<]+)</)?.[1] ?? null;

    items.push({
      buyma_item_id: id,
      buyma_url: `https://www.buyma.com/item/${id}/`,
      name_jp: name ? decodeEntities(name) : null,
      brand: brand ? decodeEntities(brand) : null,
      category: category ? decodeEntities(category) : null,
      price_jpy: priceRaw ? parseInt(priceRaw, 10) || null : null,
      seller_id: buyer?.[1] ?? null,
      seller_name: buyer?.[2] ? decodeEntities(buyer[2].trim()) : null,
      seller_type: shopperStatus
        ? (/premium/i.test(shopperStatus) ? 'premium' : 'normal')
        : null,
      rank_position: items.length + 1,
      image_url: img,
    });
  }
  return items;
}

export interface BuymaItemDetail {
  access_count: number | null;     // 조회수 (어제까지 누계)
  wish_count: number | null;       // 찜(お気に入り) 수
  listed_date: string | null;      // 등록일 (kokaidate 우선, 폴백: 이미지 URL YYMMDD)
  inquiry_count: number | null;    // 문의(お問い合わせ) 수
  latest_review_date: string | null; // 최근 구매후기 날짜 = 최근 실판매 증거
  review_count: number | null;     // 후기 수
}

/** 상품 상세 페이지 파싱 — 찜/조회수/등록일/문의수/최근판매(후기) */
export function parseItemPage(html: string): BuymaItemDetail {
  const access = html.match(/class="ac_count">([\d,]+)</)?.[1] ?? null;
  const wish = html.match(/class="fav_count">([\d,]+)/)?.[1] ?? null;

  // 등록일 ①: track_item_json 메타의 kokaidate (정확한 공개일시)
  let listedDate: string | null = null;
  const kokai = html.match(/kokaidate&quot;:&quot;(\d{4}-\d{2}-\d{2})T/) ||
                html.match(/"kokaidate":"(\d{4}-\d{2}-\d{2})T/);
  if (kokai) listedDate = kokai[1];

  // 등록일 ②(폴백): 이미지 URL의 YYMMDD
  if (!listedDate) {
    const dateM = html.match(/imgdata\/item\/(\d{6})\/0?\d+\//);
    if (dateM) {
      const [yy, mm, dd] = [dateM[1].slice(0, 2), dateM[1].slice(2, 4), dateM[1].slice(4, 6)];
      const year = 2000 + parseInt(yy, 10);
      if (year >= 2005 && +mm >= 1 && +mm <= 12 && +dd >= 1 && +dd <= 31) {
        listedDate = `${year}-${mm}-${dd}`;
      }
    }
  }

  // 문의 수: 탭 배지 <p id="tabmenu_inqcnt">28</p>
  const inq = html.match(/id="tabmenu_inqcnt">([\d,]+)</)?.[1] ?? null;

  // 최근 판매 증거: JSON-LD review의 datePublished 최댓값
  const reviewDates = [...html.matchAll(/"datePublished":"(\d{4}\/\d{2}\/\d{2})"/g)]
    .map((m) => m[1].replace(/\//g, '-'))
    .sort();
  const latestReview = reviewDates.length ? reviewDates[reviewDates.length - 1] : null;

  return {
    access_count: access ? parseInt(access.replace(/,/g, ''), 10) : null,
    wish_count: wish ? parseInt(wish.replace(/,/g, ''), 10) : null,
    listed_date: listedDate,
    inquiry_count: inq ? parseInt(inq.replace(/,/g, ''), 10) : null,
    latest_review_date: latestReview,
    review_count: reviewDates.length || null,
  };
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

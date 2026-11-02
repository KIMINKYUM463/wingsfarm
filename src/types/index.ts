export type ChannelId = string;
export type SupplierId = string;

export interface Channel {
  id: ChannelId;
  name: string;
  /** 판매수수료율(%) — 판매가 기준 */
  saleFeeRate: number;
  /** 결제수수료율(%) — 판매가 기준 */
  paymentFeeRate: number;
  /** 배송비 수수료율(%) — 고객결제 배송비 기준 */
  shippingFeeRate: number;
}

export interface Supplier {
  id: SupplierId;
  name: string;
  /** 담당자 연락처·메일 (선택) */
  contact?: string;
}

export interface PricePoint {
  date: string;
  price: number;
}

export interface Sku {
  id: string;
  code: string;
  productName: string;
  optionName: string;
  category: SeasonCategory;
  supplierId: SupplierId;
  supplyPrice: number;
  /** 공급가에 택배비가 포함되지 않은 경우 셀러가 부담하는 택배비 */
  extraShippingCost: number;
  packagingCost: number;
  taxFree: boolean;
  /** 채널별 판매가 (미판매 채널은 키 없음) */
  listings: Record<ChannelId, number>;
  /** 마켓에 등록한 다른 상품명 — 광고 보고서의 상품명과 매칭할 때 쓴다 */
  aliases: string[];
  priceHistory: PricePoint[];
}

export interface CostDefaults {
  /** 광고비율(%) — 판매가 기준 */
  adRate: number;
  /** CS 손실 적립률(%) — 판매가 기준 */
  lossRate: number;
  /** 목표 마진율(%) */
  targetMargin: number;
  /** 고객결제 배송비 기본값 */
  customerShippingFee: number;
  /** 권장가 올림 단위(원) */
  roundUnit: number;
}

export type SeasonCategory = "과일" | "채소" | "수산" | "축산" | "가공";

export interface SeasonItem {
  name: string;
  category: SeasonCategory;
  /** 제철 월 (1~12) */
  months: number[];
  tip: string;
  /** 소비자가 실제로 많이 검색하는 표기가 이름과 다를 때 (트렌드 조회용) */
  searchKeyword?: string;
}

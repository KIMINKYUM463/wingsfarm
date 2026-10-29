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

/** 발주서 양식에서 사용할 수 있는 표준 필드 */
export type OrderField =
  | "orderNo"
  | "channel"
  | "orderer"
  | "receiver"
  | "phone"
  | "zipcode"
  | "address"
  | "productName"
  | "optionName"
  | "skuCode"
  | "qty"
  | "message"
  | "bundleGroup"
  | "supplyPrice"
  | "constant";

export interface TemplateColumn {
  header: string;
  field: OrderField;
  /** field가 constant일 때 출력할 고정값 */
  value?: string;
}

export interface Supplier {
  id: SupplierId;
  name: string;
  /** 발주 마감 시각 HH:mm */
  cutoffTime: string;
  /** 출고 가능 요일 (0=일 ~ 6=토) */
  shipWeekdays: number[];
  /** 신선상품 출고 제한 요일 */
  freshBlockedWeekdays: number[];
  template: TemplateColumn[];
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
  fresh: boolean;
  /** 채널별 판매가 (미판매 채널은 키 없음) */
  listings: Record<ChannelId, number>;
  /** 주문 파일의 상품명/옵션과 매칭하기 위해 학습된 별칭 */
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

export type ClaimType = "damage" | "spoiled" | "underweight" | "quality" | "delay" | "wrongItem";


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

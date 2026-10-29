import type { Channel } from "@/types";

/**
 * 2026년 공개 자료 기준 식품·농산물 카테고리 참고값.
 * 등급·유입경로·카테고리별로 실제 요율이 다르므로 설정 화면에서 수정해 사용한다.
 */
export const DEFAULT_CHANNELS: Channel[] = [
  { id: "smartstore", name: "스마트스토어", saleFeeRate: 4, paymentFeeRate: 3.74, shippingFeeRate: 3.74 },
  { id: "coupang", name: "쿠팡", saleFeeRate: 10.8, paymentFeeRate: 0, shippingFeeRate: 3.3 },
  { id: "11st", name: "11번가", saleFeeRate: 13, paymentFeeRate: 0, shippingFeeRate: 3.3 },
  { id: "gmarket", name: "G마켓·옥션", saleFeeRate: 13, paymentFeeRate: 0, shippingFeeRate: 3.3 },
  { id: "own", name: "자사몰", saleFeeRate: 0, paymentFeeRate: 3.3, shippingFeeRate: 3.3 },
];

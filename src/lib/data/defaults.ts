import type { CostDefaults, Supplier } from "@/types";

export const emptySupplier = (id: string): Supplier => ({ id, name: "" });

export const DEFAULT_CS_POLICY = `- 신선식품 특성상 단순 변심에 의한 반품·교환은 어렵습니다.
- 수령 후 24시간 이내 사진으로 접수된 파손·변질은 보상합니다.
- 일부 파손·변질: 해당 비율만큼 부분 환불 / 절반 이상이면 재발송 또는 전액 환불 중 선택
- 중량 부족: 표기 중량의 5%를 넘게 부족하면 부족분만큼 환불
- 오배송: 즉시 정상 상품 재발송, 잘못 받은 상품은 회수하지 않음
- 배송 지연: 택배사 확인 후 안내, 지연으로 변질 시 변질 기준으로 보상`;

export const DEFAULT_COSTS: CostDefaults = {
  adRate: 5,
  lossRate: 3,
  targetMargin: 15,
  customerShippingFee: 0,
  roundUnit: 100,
};

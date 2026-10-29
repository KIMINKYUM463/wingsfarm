import type { ClaimType } from "@/types";

export interface CsGuide {
  label: string;
  evidence: string[];
  actions: string[];
}

export const CS_GUIDES: Record<ClaimType, CsGuide> = {
  damage: {
    label: "파손·눌림",
    evidence: ["박스 외관 사진", "내용물 전체 사진", "파손 부위 근접 사진", "송장 사진"],
    actions: ["파손 비율 확인 후 부분환불", "파손 50% 이상 시 재발송", "택배사 귀책이면 택배사 사고접수"],
  },
  spoiled: {
    label: "상함·변질",
    evidence: ["수령 당일 사진", "변질 부위 근접 사진", "수령 일시"],
    actions: ["수령 후 24시간 이내 접수 건 우선 보상", "전량 변질 시 재발송 또는 전액환불", "배송 지연이 원인인지 송장 조회"],
  },
  underweight: {
    label: "중량 부족",
    evidence: ["저울에 올린 사진(박스 제외)", "표기 중량 확인"],
    actions: ["농산물 특성상 수분 감량 허용범위(약 5%) 안내", "허용범위 초과 시 부족분 비율만큼 환불"],
  },
  quality: {
    label: "품질 불만(크기·당도)",
    evidence: ["상품 사진", "크기 비교 사진(손/자)"],
    actions: ["상세페이지 표기 규격과 비교", "규격 이내면 후숙·보관법 안내 후 적립금 제안", "규격 미달이면 부분환불"],
  },
  delay: {
    label: "배송 지연",
    evidence: ["송장번호", "주문 일시"],
    actions: ["송장 조회로 지연 구간 확인", "출고 전이면 예상 출고일 안내", "신선품 지연으로 변질 시 '상함' 유형으로 전환"],
  },
  wrongItem: {
    label: "오배송",
    evidence: ["받으신 상품 사진", "송장 사진"],
    actions: ["정상 상품 재발송", "오배송 상품 회수 여부 결정(신선품은 회수 생략 일반적)"],
  },
};

export const CLAIM_TYPES = Object.keys(CS_GUIDES) as ClaimType[];

/**
 * 상품정보제공고시(전자상거래법 제13조, 공정위 고시) 문구 만들기.
 * 항목은 고시의 '농수축산물'·'가공식품' 분류를 기준으로 정리했다. 고시가 개정될 수 있어 마켓 입력 화면과 대조해 쓴다.
 */

export type NoticeKind = "fresh" | "processed";

export interface NoticeField {
  key: string;
  label: string;
  placeholder: string;
  /** 비우면 "상세페이지 참조"로 채우지 않고 빈칸 경고 */
  required?: boolean;
  multiline?: boolean;
}

export const NOTICE_KINDS: { id: NoticeKind; label: string; hint: string }[] = [
  { id: "fresh", label: "농·수·축산물 (미가공)", hint: "사과·참외·고구마·활전복·생선 등 자연 상태 그대로" },
  { id: "processed", label: "가공식품", hint: "절임배추·깐마늘·건조·말린 과일·김치·젓갈·소분 포장 등" },
];

export const NOTICE_FIELDS: Record<NoticeKind, NoticeField[]> = {
  fresh: [
    { key: "name", label: "품목 또는 명칭", placeholder: "성주 참외", required: true },
    { key: "volume", label: "포장단위별 내용물의 용량(중량), 수량, 크기", placeholder: "2kg (8~12과, 개당 170~250g)", required: true },
    { key: "producer", label: "생산자(수입자)", placeholder: "OO농장 (경북 성주군)", required: true },
    { key: "origin", label: "원산지", placeholder: "국내산(경북 성주군)", required: true },
    { key: "date", label: "제조연월일(포장일 또는 생산연도), 소비기한 또는 품질유지기한", placeholder: "주문 후 수확·포장 / 수령 후 냉장 7일 이내 섭취 권장", required: true },
    { key: "legal", label: "관련법상 표시사항", placeholder: "해당 없음 (지리적표시·GAP 인증이 있으면 인증번호)" },
    { key: "composition", label: "상품구성", placeholder: "참외 2kg 1박스", required: true },
    { key: "storage", label: "보관방법 또는 취급방법", placeholder: "수령 즉시 냉장 보관, 씻지 않은 상태로 보관", required: true },
    { key: "caution", label: "소비자안전을 위한 주의사항", placeholder: "농산물 특성상 개체별 크기·당도 차이가 있을 수 있습니다" },
    { key: "phone", label: "소비자상담 관련 전화번호", placeholder: "010-0000-0000", required: true },
  ],
  processed: [
    { key: "name", label: "제품명", placeholder: "해남 절임배추", required: true },
    { key: "type", label: "식품의 유형", placeholder: "절임식품", required: true },
    { key: "producer", label: "생산자 및 소재지 (수입품은 수입자·제조국)", placeholder: "OO영농조합 / 전남 해남군 OO면", required: true },
    { key: "date", label: "제조연월일, 소비기한 또는 품질유지기한", placeholder: "제조일로부터 7일 (냉장)", required: true },
    { key: "volume", label: "포장단위별 내용물의 용량(중량), 수량", placeholder: "20kg (6~8포기)", required: true },
    { key: "ingredients", label: "원재료명 및 함량 (원산지 포함)", placeholder: "배추 95%(국산), 천일염 5%(국산)", required: true, multiline: true },
    { key: "nutrition", label: "영양성분", placeholder: "해당 없음 (영양표시 대상이면 표기)" },
    { key: "gmo", label: "유전자변형식품 해당 여부", placeholder: "해당 없음" },
    { key: "caution", label: "소비자안전을 위한 주의사항 (알레르기 등)", placeholder: "이 제품은 OO를 사용한 제품과 같은 시설에서 제조" },
    { key: "imported", label: "수입식품 문구", placeholder: "해당 없음 (수입품은 '수입식품안전관리 특별법에 따른 수입신고를 필함')" },
    { key: "phone", label: "소비자상담 관련 전화번호", placeholder: "010-0000-0000", required: true },
  ],
};

export function buildNoticeText(kind: NoticeKind, values: Record<string, string>) {
  return NOTICE_FIELDS[kind].map((f) => `${f.label} : ${values[f.key]?.trim() || "상세페이지 참조"}`).join("\n");
}

export const missingNoticeFields = (kind: NoticeKind, values: Record<string, string>) =>
  NOTICE_FIELDS[kind].filter((f) => f.required && !values[f.key]?.trim());

export interface OriginInput {
  domestic: boolean;
  /** 국내: 시·도 + 시·군 / 수입: 국가명 */
  region: string;
}

/** 상품명·가격 옆에 그대로 붙이는 원산지 표기 */
export function buildOriginLabel({ domestic, region }: OriginInput) {
  const place = region.trim();
  if (domestic) return place ? `원산지: 국내산(${place})` : "원산지: 국내산";
  return place ? `원산지: ${place.replace(/산$/, "")}산` : "";
}

export interface QualitySpec {
  /** 총 중량 kg */
  totalKg: number;
  /** 개당 중량 범위 g (0이면 생략) */
  minGram: number;
  maxGram: number;
  /** 선별 당도 Brix (0이면 생략) */
  brix: number;
  /** 표준규격 등급 */
  grade: "" | "특" | "상" | "보통";
}

/** 소비자원 권고처럼 크기·당도·등급을 객관적 수치로 적은 한 줄 */
export function buildQualityLine(spec: QualitySpec) {
  const parts: string[] = [];
  if (spec.totalKg > 0) {
    const count =
      spec.minGram > 0 && spec.maxGram >= spec.minGram
        ? ` (${Math.floor((spec.totalKg * 1000) / spec.maxGram)}~${Math.ceil((spec.totalKg * 1000) / spec.minGram)}과 내외)`
        : "";
    parts.push(`총 ${spec.totalKg}kg${count}`);
  }
  if (spec.minGram > 0 && spec.maxGram >= spec.minGram) parts.push(`개당 ${spec.minGram}~${spec.maxGram}g`);
  if (spec.brix > 0) parts.push(`당도 ${spec.brix}Brix 이상 선별`);
  if (spec.grade) parts.push(`등급 ${spec.grade} (농산물 표준규격)`);
  return parts.join(" · ");
}

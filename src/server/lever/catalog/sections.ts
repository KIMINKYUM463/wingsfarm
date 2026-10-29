import type { CategoryId } from './categories';

/**
 * 섹션 카탈로그 (후커블 분석서 "섹션 카탈로그" 기준, GIF 섹션 제외)
 *
 * - layout: 섹션을 그리는 레이아웃 종류 (templates/sectionLayouts.ts)
 * - evidence: 이 자료를 입력해야만 추천·추가할 수 있는 섹션 (근거 없는 후기·인증·순위 방지)
 * - items: AI가 채울 항목(문장) 수 [최소, 최대]
 * - cuts: 사진 컷 수 — none(없음) / one(1장) / perItem(항목마다 1장)
 */
export type SectionLayout =
  | 'hero'
  | 'visual'
  | 'points'
  | 'grid'
  | 'compare'
  | 'size'
  | 'story'
  | 'steps'
  | 'table'
  | 'faq'
  | 'reviews'
  | 'badges'
  | 'cta'
  | 'contact'
  | 'notice';

export type EvidenceKey =
  | 'reviews'
  | 'certifications'
  | 'salesRecord'
  | 'producer'
  | 'origin'
  | 'harvest'
  | 'selection'
  | 'directShipping'
  | 'options'
  | 'promotion'
  | 'facility'
  | 'model';

export type SectionGroup = '도입' | '신뢰' | '상품 설명' | '스토리' | '활용' | '구매 유도' | '옵션·세트' | '배송' | '마무리';

export interface SectionType {
  id: string;
  name: string;
  description: string;
  group: SectionGroup;
  layout: SectionLayout;
  items: [number, number];
  cuts: 'none' | 'one' | 'perItem';
  evidence?: EvidenceKey;
  /** 인물(모델) 연출이 어울리는 섹션 */
  modelCapable?: boolean;
  /** AI에게 주는 이 섹션의 역할 설명 */
  guide: string;
}

export const EVIDENCE_LABELS: Record<EvidenceKey, string> = {
  reviews: '실제 고객 후기',
  certifications: '인증 정보(인증명·번호)',
  salesRecord: '판매 실적·순위 자료',
  producer: '생산자(농가) 이야기',
  origin: '산지·원산지 정보',
  harvest: '수확 시기·제철 정보',
  selection: '선별 기준',
  directShipping: '산지직송 여부',
  options: '판매 옵션',
  promotion: '이벤트·혜택 정보',
  facility: '시설·제조 공정 정보',
  model: '등장 모델 설정',
};

const T = (
  id: string,
  name: string,
  group: SectionGroup,
  layout: SectionLayout,
  description: string,
  guide: string,
  extra: Partial<Pick<SectionType, 'items' | 'cuts' | 'evidence' | 'modelCapable'>> = {},
): SectionType => ({
  id,
  name,
  group,
  layout,
  description,
  guide,
  items: extra.items ?? DEFAULT_ITEMS[layout],
  cuts: extra.cuts ?? DEFAULT_CUTS[layout],
  evidence: extra.evidence,
  modelCapable: extra.modelCapable,
});

const DEFAULT_ITEMS: Record<SectionLayout, [number, number]> = {
  hero: [3, 3],
  visual: [1, 2],
  points: [3, 3],
  grid: [4, 4],
  compare: [3, 5],
  size: [2, 3],
  story: [1, 3],
  steps: [3, 5],
  table: [3, 8],
  faq: [3, 5],
  reviews: [2, 4],
  badges: [1, 4],
  cta: [1, 2],
  contact: [2, 4],
  notice: [1, 1],
};

const DEFAULT_CUTS: Record<SectionLayout, SectionType['cuts']> = {
  hero: 'one',
  visual: 'one',
  points: 'perItem',
  grid: 'perItem',
  compare: 'one',
  size: 'one',
  story: 'one',
  steps: 'none',
  table: 'one',
  faq: 'none',
  reviews: 'none',
  badges: 'none',
  cta: 'one',
  contact: 'none',
  notice: 'none',
};

// ===== 공통 섹션 =====
const COMMON = [
  T('hero', '히어로', '도입', 'hero', '첫 화면. 상품을 한눈에 보여주는 대표 비주얼', '상품의 가장 큰 매력을 짧은 메인 문구로, 항목 3개는 6자 이내 핵심 키워드', { modelCapable: true }),
  T('concept', '컨셉 비주얼', '도입', 'visual', '분위기·사용 장면으로 상품의 컨셉을 전달', '상품이 주는 경험·분위기를 감성적으로 표현', { modelCapable: true }),
  T('certification', '인증', '신뢰', 'badges', '보유한 인증을 인증번호와 함께 보여줌', '입력된 인증명·번호만 그대로 사용. 없는 인증은 절대 쓰지 않음', { evidence: 'certifications' }),
  T('review', '고객 후기', '신뢰', 'reviews', '실제 구매 고객 후기 카드', '입력된 실제 후기 문장만 짧게 인용(의미 변경 금지). 작성자는 마스킹', { evidence: 'reviews' }),
  T('social_proof', '판매 실적·순위', '신뢰', 'points', '판매량·순위 등 실적', '입력된 판매 실적 수치만 사용', { evidence: 'salesRecord', items: [2, 3], cuts: 'none' }),
  T('facility', '시설', '신뢰', 'story', '생산·제조 시설과 위생 관리', '입력된 시설·공정 정보만 사용', { evidence: 'facility' }),
  T('quality', '품질', '상품 설명', 'points', '품질을 보여주는 핵심 포인트 3가지', '특징 입력을 근거로 품질 포인트 3개', {}),
  T('comparison', '고르는 기준', '상품 설명', 'compare', '좋은 상품을 고르는 기준과 이 상품의 답', '다른 상품을 깎아내리지 말고 "확인할 점 → 이 상품" 형식. 확인된 사실만'),
  T('size_comparison', '크기 비교', '상품 설명', 'size', '크기·용량을 익숙한 물건과 비교', '입력된 규격·중량만 사용. 없으면 "사진으로 크기를 확인하세요" 수준으로'),
  T('point_sum', '핵심 특징 요약', '상품 설명', 'grid', '핵심 특징을 아이콘 카드로 요약', '특징 4개를 각 8자 이내 제목 + 15자 내외 설명으로'),
  T('detail', '상세 컷', '상품 설명', 'points', '디테일 사진과 설명', '눈여겨볼 디테일 3가지', { items: [2, 3] }),
  T('usage', '사용 장면', '활용', 'grid', '이렇게 쓰면 좋아요 — 활용 장면', '사용·활용 장면 3~4개', { items: [3, 4], modelCapable: true }),
  T('how_to', '사용 방법', '활용', 'steps', '순서대로 따라 하는 사용법', '사용 순서를 단계별로. 확인된 방법만'),
  T('spec', '상품 정보', '상품 설명', 'table', '규격·구성·보관 등 기본 정보 표', '입력된 정보만 표로. 모르는 칸은 "[입력 필요]"'),
  T('options', '옵션·가격', '옵션·세트', 'table', '판매 옵션 한눈에 보기', '입력된 옵션 이름·규격만 사용', { evidence: 'options' }),
  T('package', '선물 포장', '옵션·세트', 'visual', '선물하기 좋은 포장 구성', '포장 사진이 있을 때 선물 상황을 제안'),
  T('conversion', '구매 유도(환기)', '구매 유도', 'cta', '마지막으로 구매를 결심하게 하는 한마디', '핵심 가치를 다시 한번 짧게'),
  T('promotion', '이벤트·혜택', '구매 유도', 'cta', '진행 중인 이벤트·쿠폰', '입력된 혜택만 사용', { evidence: 'promotion' }),
  T('shipping_method', '배송 안내', '배송', 'steps', '주문부터 받는 날까지 배송 과정', '입력된 배송 정보만. 없으면 일반적인 안내 + "[입력 필요]"'),
  T('faq', 'FAQ', '마무리', 'faq', '자주 묻는 질문', '고객이 실제로 궁금해할 질문과, 입력 정보로 답할 수 있는 답만'),
  T('contact', '고객센터', '마무리', 'contact', '문의처·운영 시간', '입력된 연락처만. 없으면 "[입력 필요]"'),
  T('notice_ai', 'AI 콘텐츠 고지', '마무리', 'notice', 'AI로 만든 이미지가 포함됐다는 안내', '"일부 이미지는 AI로 연출되었으며 실제 상품과 다를 수 있습니다" 수준'),
] as const satisfies readonly SectionType[];

// ===== 카테고리 전용 섹션 =====
const AGRI = [
  T('season', '제철', '상품 설명', 'story', '지금이 가장 맛있는 이유 — 제철', '입력된 수확 시기·제철 정보만 사용', { evidence: 'harvest' }),
  T('selection_process', '선별 과정', '상품 설명', 'steps', '어떤 기준으로 골라 보내는지', '입력된 선별 기준만 단계로', { evidence: 'selection' }),
  T('point_producer', '농부 포인트', '스토리', 'story', '키운 사람의 이야기', '입력된 생산자 이야기만 사용', { evidence: 'producer', modelCapable: true }),
  T('point_producer_reason', '농부 포인트 이유', '스토리', 'points', '그 농부라서 다른 점', '생산자 이야기에서 나온 근거만', { evidence: 'producer', items: [2, 3] }),
  T('point_origin', '원산지 포인트', '스토리', 'story', '자란 곳의 환경과 이야기', '입력된 산지 정보만 사용', { evidence: 'origin' }),
  T('point_origin_reason', '원산지 포인트 이유', '스토리', 'points', '그 산지라서 좋은 이유', '산지 정보에서 나온 근거만', { evidence: 'origin', items: [2, 3] }),
  T('point_direct', '산지직송', '스토리', 'steps', '산지에서 바로 보내는 과정', '산지직송으로 입력된 경우에만', { evidence: 'directShipping' }),
  T('recipe', '레시피', '활용', 'steps', '맛있게 먹는 방법', '일반적인 조리·섭취 방법 (효능 주장 금지)'),
  T('storage_washing', '보관·세척', '활용', 'steps', '받은 뒤 보관·손질하는 법', '일반적인 보관·세척 방법'),
  T('set_line_up', '세트 구성', '옵션·세트', 'grid', '세트별 구성 한눈에', '입력된 옵션 구성만', { evidence: 'options', items: [2, 4] }),
  T('delivery', '배송 일정', '배송', 'table', '출고일·도착 예정', '입력된 배송 정보만. 없으면 "[입력 필요]"'),
  T('season_delivery_schedule', '명절 배송 일정', '배송', 'table', '명절 주문 마감·도착 일정', '명절 일정은 "[입력 필요]"로 비워 두고 판매자가 채우게 함'),
  T('season_banner', '명절 인사', '배송', 'visual', '명절 선물 인사 배너', '명절 선물 상황 제안 (과장 금지)'),
  T('data_notice', '개인정보 제3자 제공', '마무리', 'notice', '산지 발송을 위한 개인정보 제공 안내', '산지에서 직접 발송할 때 필요한 고지 문구'),
] as const satisfies readonly SectionType[];

const FOOD = [
  T('ingredients', '원재료', '상품 설명', 'table', '들어간 원재료와 함량', '입력된 원재료만'),
  T('no_additive', '무첨가', '상품 설명', 'grid', '넣지 않은 것들', '입력에 "무첨가"로 확인된 항목만', { evidence: 'facility', items: [2, 4], cuts: 'none' }),
  T('taste', '맛', '상품 설명', 'points', '맛과 식감 표현', '사진과 특징을 근거로 맛 표현 (과장 금지)'),
  T('recipe', '레시피', '활용', 'steps', '맛있게 먹는 방법', '일반적인 조리 방법'),
  T('storage_washing', '보관 방법', '활용', 'steps', '보관·해동 방법', '일반적인 보관 방법'),
  T('delivery', '배송 일정', '배송', 'table', '출고일·도착 예정', '입력된 배송 정보만'),
] as const satisfies readonly SectionType[];

const ELECTRONICS = [
  T('problem', '문제 제기', '도입', 'visual', '고객이 겪는 불편', '고객의 일상 속 불편을 공감형으로'),
  T('problem_cause', '문제 원인', '상품 설명', 'points', '불편이 생기는 이유', '일반적인 원인 설명 (경쟁사 비방 금지)', { items: [2, 3] }),
  T('solution', '해결 소개', '상품 설명', 'visual', '이 상품이 해결하는 방법', '특징 입력을 근거로'),
  T('modes', '모드·기능', '상품 설명', 'grid', '모드·기능 소개', '입력된 기능만'),
  T('development', '개발 과정', '스토리', 'steps', '만들어진 과정', '입력된 정보만', { evidence: 'facility' }),
] as const satisfies readonly SectionType[];

const FASHION = [
  T('zoom_visual', '줌인 비주얼', '도입', 'visual', '모델 착용 클로즈업', '착용 분위기를 짧게', { evidence: 'model', modelCapable: true }),
  T('size_model', '사이즈·모델 정보', '상품 설명', 'table', '사이즈표와 모델 착용 정보', '입력된 사이즈만. 없으면 "[입력 필요]"'),
  T('styling', '스타일링', '활용', 'grid', '코디 제안', '어울리는 코디 3~4개', { items: [3, 4], modelCapable: true }),
  T('fabric', '원단 디테일', '상품 설명', 'points', '소재·마감 디테일', '입력된 소재만', { items: [2, 3] }),
] as const satisfies readonly SectionType[];

const BEAUTY = [
  T('ingredients', '성분', '상품 설명', 'table', '주요 성분', '입력된 성분만. 효능 단정 금지'),
  T('texture', '제형·사용감', '상품 설명', 'points', '발림성·사용감', '사진·특징 근거로', { items: [2, 3] }),
  T('how_to', '사용 방법', '활용', 'steps', '사용 순서', '일반적인 사용법'),
] as const satisfies readonly SectionType[];

const HEALTH = [
  T('functional', '기능성', '상품 설명', 'badges', '인정받은 기능성 내용', '입력된 인증·기능성 문구만 그대로', { evidence: 'certifications' }),
  T('nutrition', '영양·함량', '상품 설명', 'table', '1회 섭취량 기준 함량', '입력된 함량만'),
  T('dosage', '섭취 방법', '활용', 'steps', '섭취 방법·주의사항', '입력된 섭취 방법만. 없으면 "[입력 필요]"'),
  T('formulation', '제형', '상품 설명', 'story', '제형·크기', '사진 근거로'),
] as const satisfies readonly SectionType[];

const EDU = [
  T('curriculum', '커리큘럼', '상품 설명', 'steps', '배우는 순서', '입력된 커리큘럼만'),
  T('instructor', '강사', '신뢰', 'story', '강사 소개', '입력된 경력만', { modelCapable: true }),
  T('usp', '차별점', '상품 설명', 'points', '이 강의만의 강점', '특징 입력 근거로'),
  T('benefit', '혜택', '구매 유도', 'grid', '수강 혜택', '입력된 혜택만', { evidence: 'promotion', items: [2, 4], cuts: 'none' }),
] as const satisfies readonly SectionType[];

const CLINIC = [
  T('doctor', '의료진', '신뢰', 'story', '의료진 소개', '입력된 경력만', { modelCapable: true }),
  T('equipment', '장비', '신뢰', 'points', '사용 장비', '입력된 장비만', { items: [2, 3] }),
  T('procedure_steps', '시술 단계', '상품 설명', 'steps', '시술 진행 순서', '입력된 절차만'),
  T('safety', '안전', '신뢰', 'points', '안전 관리', '입력된 내용만. 효과 단정 금지', { items: [2, 3] }),
  T('location', '위치', '마무리', 'contact', '오시는 길', '입력된 주소만'),
] as const satisfies readonly SectionType[];

const CATEGORY_SECTIONS: Record<CategoryId, readonly SectionType[]> = {
  agri: AGRI,
  food: FOOD,
  electronics: ELECTRONICS,
  living: ELECTRONICS,
  fashion: FASHION,
  accessory: FASHION,
  beauty: BEAUTY,
  health: HEALTH,
  edu: EDU,
  clinic: CLINIC,
};

/** 카테고리 전용 섹션이 같은 id의 공통 섹션을 덮어쓴다 */
export function sectionTypesFor(categoryId: string): SectionType[] {
  const extra = CATEGORY_SECTIONS[categoryId as CategoryId] ?? [];
  const byId = new Map<string, SectionType>();
  for (const type of [...COMMON, ...extra]) byId.set(type.id, type);
  return [...byId.values()];
}

export const findSectionType = (categoryId: string, typeId: string) =>
  sectionTypesFor(categoryId).find((t) => t.id === typeId);

/**
 * 기본 흐름 (AI 기획이 실패했을 때, 그리고 AI에게 주는 참고 순서)
 * 근거가 없는 섹션은 자동으로 빠진다.
 */
const FLOWS: Partial<Record<CategoryId, { short: string[]; long: string[] }>> = {
  agri: {
    short: ['hero', 'concept', 'review', 'quality', 'comparison', 'size_comparison', 'point_sum', 'point_origin', 'point_origin_reason', 'point_producer', 'point_producer_reason', 'conversion', 'shipping_method', 'faq', 'contact'],
    long: ['hero', 'concept', 'review', 'season', 'quality', 'selection_process', 'comparison', 'size_comparison', 'point_sum', 'point_origin', 'point_origin_reason', 'point_producer', 'point_producer_reason', 'point_direct', 'recipe', 'storage_washing', 'options', 'package', 'conversion', 'promotion', 'shipping_method', 'delivery', 'faq', 'contact', 'notice_ai'],
  },
  electronics: {
    short: ['hero', 'problem', 'problem_cause', 'solution', 'quality', 'modes', 'usage', 'spec', 'review', 'conversion', 'faq', 'contact'],
    long: ['hero', 'concept', 'problem', 'problem_cause', 'solution', 'quality', 'modes', 'detail', 'development', 'usage', 'how_to', 'comparison', 'spec', 'options', 'review', 'certification', 'conversion', 'promotion', 'shipping_method', 'faq', 'contact', 'notice_ai'],
  },
};

const GENERIC_FLOW = {
  short: ['hero', 'concept', 'review', 'quality', 'point_sum', 'detail', 'usage', 'spec', 'options', 'conversion', 'shipping_method', 'faq', 'contact'],
  long: ['hero', 'concept', 'review', 'certification', 'quality', 'point_sum', 'detail', 'comparison', 'size_comparison', 'usage', 'how_to', 'spec', 'options', 'package', 'conversion', 'promotion', 'shipping_method', 'faq', 'contact', 'notice_ai'],
};

export const LENGTH_TARGET = { short: [12, 15], long: [20, 25] } as const;

export function defaultFlow(categoryId: string, length: 'short' | 'long', available: (type: SectionType) => boolean) {
  const types = sectionTypesFor(categoryId);
  const flow = FLOWS[categoryId as CategoryId] ?? GENERIC_FLOW;
  const base = flow[length].filter((id) => types.some((t) => t.id === id));
  const extras = types.map((t) => t.id).filter((id) => !base.includes(id));
  const usable = (id: string) => {
    const type = types.find((t) => t.id === id);
    return Boolean(type && available(type));
  };
  const picked = base.filter(usable);
  const [min] = LENGTH_TARGET[length];
  for (const id of extras) {
    if (picked.length >= min) break;
    if (usable(id)) picked.splice(Math.max(picked.length - 3, 1), 0, id);
  }
  return picked;
}

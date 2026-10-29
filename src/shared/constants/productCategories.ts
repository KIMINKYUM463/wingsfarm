/**
 * 상품 카테고리 (후커블과 같은 10개 분류, 농수산물 우선)
 * - keywordHints: AI 키워드 생성·카테고리 매칭 시 카테고리 맥락으로 사용
 * - 서버(섹션 카탈로그)와 화면(입력 폼)이 같은 목록을 쓴다
 */
export const PRODUCT_CATEGORIES = [
  { id: 'agri', name: '농수산물', emoji: '🍊', keywordHints: ['산지', '제철', '신선도', '당도·크기', '선별', '보관'] },
  { id: 'food', name: '식품류', emoji: '🍱', keywordHints: ['맛', '원재료', '무첨가', '조리법', '보관'] },
  { id: 'electronics', name: '가전/디지털', emoji: '🔌', keywordHints: ['성능', '소음', '전력', '편의 기능', 'A/S'] },
  { id: 'living', name: '생활용품/리빙', emoji: '🧺', keywordHints: ['내구성', '수납', '사용 편의', '위생', '공간 활용'] },
  { id: 'fashion', name: '의류/패션', emoji: '👕', keywordHints: ['소재', '핏', '착용감', '코디', '세탁'] },
  { id: 'accessory', name: '패션잡화', emoji: '👜', keywordHints: ['소재', '수납력', '사이즈', '스타일링', '마감'] },
  { id: 'beauty', name: '화장품/뷰티', emoji: '💄', keywordHints: ['성분', '피부타입', '발림성', '지속력', '자극'] },
  { id: 'health', name: '건강기능식품', emoji: '💊', keywordHints: ['기능성', '원료', '섭취 방법', '제형', '함량'] },
  { id: 'edu', name: '지식서비스/교육', emoji: '📚', keywordHints: ['커리큘럼', '강사', '대상', '결과물', '혜택'] },
  { id: 'clinic', name: '뷰티시술/클리닉', emoji: '🏥', keywordHints: ['시술', '의료진', '장비', '안전', '위치'] },
] as const;

export type ProductCategoryId = (typeof PRODUCT_CATEGORIES)[number]['id'];

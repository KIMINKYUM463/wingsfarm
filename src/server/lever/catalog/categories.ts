import type { Category } from '@/shared/types/category';
import { emojiIcon } from './svg';

/**
 * 상품 카테고리 (레버페이지 관리자 화면의 10개 분류와 동일)
 * - keywordHints: AI 키워드 생성 시 카테고리 맥락으로 사용
 */
export const CATEGORIES = [
  { id: 'food', name: '식품', emoji: '🍎', keywordHints: ['맛', '원산지', '신선도', '영양', '보관'] },
  { id: 'beauty', name: '뷰티', emoji: '💄', keywordHints: ['성분', '피부타입', '발림성', '지속력', '자극'] },
  { id: 'fashion', name: '패션의류', emoji: '👕', keywordHints: ['소재', '핏', '착용감', '코디', '세탁'] },
  { id: 'electronics', name: '가전', emoji: '🔌', keywordHints: ['성능', '소음', '전력', '편의 기능', 'A/S'] },
  { id: 'living', name: '생활', emoji: '🧺', keywordHints: ['내구성', '수납', '사용 편의', '위생', '공간 활용'] },
  { id: 'sports', name: '스포츠', emoji: '⚽', keywordHints: ['기능성', '경량', '통기성', '그립감', '퍼포먼스'] },
  { id: 'pet', name: '반려', emoji: '🐶', keywordHints: ['기호성', '안전 성분', '건강', '사이즈', '훈련'] },
  { id: 'kids', name: '키즈', emoji: '🧸', keywordHints: ['안전 인증', '발달', '소재', '연령', '세척'] },
  { id: 'plant', name: '식물', emoji: '🪴', keywordHints: ['관리 난이도', '공기정화', '햇빛', '물주기', '인테리어'] },
  { id: 'etc', name: '기타', emoji: '📦', keywordHints: ['품질', '활용도', '구성', '가성비', '선물'] },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]['id'];

export const findCategory = (id: string | null | undefined) => CATEGORIES.find((c) => c.id === id);

export const categoryImageUrl = (id: string) => emojiIcon(findCategory(id)?.emoji ?? '📦');

/** GET /categories 응답용 (키워드 그룹은 카테고리 힌트로 구성) */
export const toCategoryList = (): Category[] =>
  CATEGORIES.map((category) => ({
    id: category.id,
    name: category.name,
    path: category.name,
    level: 1,
    hasChildren: false,
    keywordGroups: [
      {
        id: `${category.id}-core`,
        name: '핵심 포인트',
        description: `${category.name} 상품에서 자주 강조하는 요소`,
        keywords: category.keywordHints.map((name, index) => ({
          id: `${category.id}-core-${index}`,
          name,
          description: name,
          priority: index + 1,
        })),
      },
    ],
    totalKeywordGroups: 1,
    totalKeywords: category.keywordHints.length,
  }));

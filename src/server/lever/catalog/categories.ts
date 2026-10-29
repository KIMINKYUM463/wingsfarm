import type { Category } from '@/shared/types/category';
import { PRODUCT_CATEGORIES as CATEGORIES, type ProductCategoryId as CategoryId } from '@/shared/constants/productCategories';
import { emojiIcon } from './svg';

export { CATEGORIES, type CategoryId };

/** 이전 분류(레버페이지 10개)로 만든 프로젝트를 가장 가까운 새 분류로 연결 */
const LEGACY_ALIASES: Record<string, CategoryId> = {
  sports: 'living',
  pet: 'living',
  kids: 'living',
  plant: 'living',
  etc: 'living',
};

export const findCategory = (id: string | null | undefined) => {
  if (!id) return undefined;
  const resolved = LEGACY_ALIASES[id] ?? id;
  return CATEGORIES.find((c) => c.id === resolved);
};

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

import type { DraftInput } from '@/shared/types/draft';

/** 카테고리마다 "직접 느낀 점"을 묻는 말 */
export const sensoryLabel = (categoryId: string) =>
  categoryId === 'agri' || categoryId === 'food'
    ? '맛·식감'
    : categoryId === 'beauty'
      ? '사용감·향'
      : categoryId === 'fashion' || categoryId === 'accessory'
        ? '착용감·촉감'
        : '써 보면 느끼는 점';

export const sensoryPlaceholder = (categoryId: string) =>
  categoryId === 'agri' || categoryId === 'food'
    ? '예) 한입 베면 아삭하고 과즙이 손목까지 흘러요. 단맛 뒤에 새콤함이 살짝 남아요.'
    : categoryId === 'beauty'
      ? '예) 바르면 물처럼 퍼지고 끈적임 없이 1분 안에 흡수돼요.'
      : '예) 처음 만졌을 때 생각보다 가볍고, 손잡이가 손에 착 감겨요.';

export const sizePlaceholder = (categoryId: string) =>
  categoryId === 'agri' || categoryId === 'food' ? '예) 한 알 300g 내외(어른 주먹만 함), 5kg 한 상자에 14~16과' : '예) 가로 32cm × 세로 20cm, 무게 450g';

/**
 * 문구의 재료가 되는 사실 개수 (특징 줄 + 채운 칸)
 * 너무 적으면 같은 말을 섹션마다 되풀이하게 되므로 입력 화면에서 더 적어 달라고 안내한다
 */
export function countFacts(input: DraftInput) {
  const filled = (s: string) => s.trim().length > 0;
  const featureLines = input.features.split('\n').filter((line) => filled(line.replace(/^\s*(?:\d+[.)]|[-*•])\s*/, ''))).length;
  return (
    featureLines +
    [input.sizeInfo, input.sensory, input.agri.origin, input.agri.harvest, input.agri.selection, input.agri.producerStory, input.salesRecord, input.facility, input.promotion].filter(filled)
      .length +
    (input.reviewsText.trim() || input.reviewImagePaths.length ? 1 : 0) +
    (input.certifications.some((c) => filled(c.name)) ? 1 : 0)
  );
}

/** 이보다 적으면 "더 적어 주세요" 안내 */
export const THIN_FACT_COUNT = 8;

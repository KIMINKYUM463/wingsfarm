/** "템플릿으로 빠르게 시작" 길이 */
export type TemplateStartLength = 'short' | 'long';

/** 긴 구성에서 구성(part2)마다 넣는 템플릿 수 — 설득·정보 본문을 늘리고, 도입·공감·마무리는 하나씩 (없는 구성은 1) */
export const LONG_TEMPLATE_COUNTS: Readonly<Record<string, number>> = {
  '핵심 포인트': 3,
  '상품 특징': 3,
  '상세 정보': 2,
  '고객 후기': 2,
};

export const TEMPLATE_START_LENGTHS: { id: TemplateStartLength; title: string; description: string }[] = [
  { id: 'short', title: '짧은 구성', description: '구성마다 1개 · 약 8개 섹션' },
  { id: 'long', title: '긴 구성', description: '포인트·특징·정보를 늘려 약 14개 섹션' },
];

export const isTemplateStartLength = (value: unknown): value is TemplateStartLength => value === 'short' || value === 'long';

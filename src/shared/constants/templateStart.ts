/** "템플릿으로 빠르게 시작" 길이 */
export type TemplateStartLength = 'short' | 'long' | 'extra';

/** 긴 구성에서 구성(part2)마다 넣는 템플릿 수 — 설득·정보 본문을 늘리고, 도입·공감·마무리는 하나씩 (없는 구성은 1) */
export const LONG_TEMPLATE_COUNTS: Readonly<Record<string, number>> = {
  '핵심 포인트': 3,
  '상품 특징': 3,
  '상세 정보': 2,
  '고객 후기': 2,
};

/** 더 긴 구성 — 비교·인증·사용법·FAQ까지 넣고 본문 구성을 더 늘린다 */
export const EXTRA_TEMPLATE_COUNTS: Readonly<Record<string, number>> = {
  '호기심 유발': 2,
  '핵심 포인트': 4,
  '상품 특징': 4,
  '비교 분석': 1,
  '인증·실적': 1,
  '상세 정보': 2,
  '사용 방법': 1,
  '고객 후기': 2,
  FAQ: 1,
};

/** 더 긴 구성에만 넣는 구성(짧은·긴은 초안 8칸만) */
export const EXTRA_DRAFT_PART2S = [
  '메인 비주얼',
  '문제 제기',
  '호기심 유발',
  '핵심 포인트',
  '상품 특징',
  '비교 분석',
  '인증·실적',
  '상세 정보',
  '사용 방법',
  '고객 후기',
  'FAQ',
  '구매 안내',
] as const;

export const TEMPLATE_START_LENGTH_LABEL: Record<TemplateStartLength, string> = {
  short: '짧은 구성',
  long: '긴 구성',
  extra: '더 긴 구성',
};

export const TEMPLATE_START_LENGTHS: { id: TemplateStartLength; title: string; description: string }[] = [
  { id: 'short', title: '짧은 구성', description: 'AI가 상품에 맞는 템플릿을 골라 · 약 8개 섹션' },
  { id: 'long', title: '긴 구성', description: '포인트·특징을 늘려 약 14개 섹션 · AI가 어울리는 템플릿 선택' },
  { id: 'extra', title: '더 긴 구성', description: '비교·인증·사용법까지 넣어 약 20개 섹션 · AI가 어울리는 템플릿 선택' },
];

export const isTemplateStartLength = (value: unknown): value is TemplateStartLength =>
  value === 'short' || value === 'long' || value === 'extra';

export function templateCountFor(part2: string, length: TemplateStartLength): number {
  if (length === 'extra') return EXTRA_TEMPLATE_COUNTS[part2] ?? 1;
  if (length === 'long') return LONG_TEMPLATE_COUNTS[part2] ?? 1;
  return 1;
}

export function part2sForLength(length: TemplateStartLength, shortOrder: readonly string[]): readonly string[] {
  return length === 'extra' ? EXTRA_DRAFT_PART2S : shortOrder;
}

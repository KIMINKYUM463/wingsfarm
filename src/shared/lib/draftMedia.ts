import type { CutRole, CutSource, DraftImageMode, HeroMotion } from '../types/draft';

/**
 * 상세페이지 사진·움직이는 컷 규칙 (서버 기획·생성과 화면이 함께 사용)
 *
 * 비용은 Gemini 공개 단가 기준 추정치 — 실제 청구는 사용자의 Gemini 키로 된다.
 */
export const MEDIA_COST = {
  /** gemini-2.5-flash-image 1장 */
  aiImageUsd: 0.039,
  /** gemini-omni-1.1-flash 720p 1초 */
  videoUsdPerSecond: 0.1,
  heroVideoSeconds: 5,
  krwPerUsd: 1400,
} as const;

export const HERO_VIDEO_USD = MEDIA_COST.videoUsdPerSecond * MEDIA_COST.heroVideoSeconds;

/** 움직이는 GIF·WebP 목표 용량 (넘으면 줄이거나 안내) */
export const GIF_MAX_BYTES = 10 * 1024 * 1024;

export const isHeroMotion = (value: unknown): value is HeroMotion => value === 'off' || value === 'pan' || value === 'video';

/** 기획할 때 컷마다 처음 정하는 사진 방식 — 실물 증거 컷만 올린 사진, 나머지는 AI 연출 */
export function defaultCutSource(mode: DraftImageMode, role: CutRole, photoCount: number): CutSource {
  if (mode === 'blank') return 'blank';
  return role === 'proof' && photoCount > 0 ? 'own' : 'ai';
}

/** 올린 사진 한 장을 페이지에서 그대로 쓰는 최대 횟수 — 넘으면 같은 사진이 섹션마다 반복돼 보인다 */
export const OWN_PHOTO_REUSE_LIMIT = 2;

/**
 * "내 사진" 컷이 한 사진에 몰리지 않게 나눈다 (페이지 위에서부터 순서대로).
 * 한도를 넘은 컷은 아직 덜 쓴 다른 사진으로 옮기고, 남은 사진이 없으면 AI 연출로 돌린다.
 */
export function spreadOwnCuts<T extends { source: CutSource; photoIndexes: number[] }>(cuts: T[], photoCount: number, limit = OWN_PHOTO_REUSE_LIMIT): T[] {
  const used = new Map<number, number>();
  const take = (photo: number) => used.set(photo, (used.get(photo) ?? 0) + 1);
  return cuts.map((cut) => {
    if (cut.source !== 'own') return cut;
    const wanted = cut.photoIndexes[0] ?? 0;
    if ((used.get(wanted) ?? 0) < limit) {
      take(wanted);
      return cut;
    }
    const spare = Array.from({ length: photoCount }, (_, i) => i).find((i) => (used.get(i) ?? 0) < limit);
    if (spare === undefined) return { ...cut, source: 'ai' };
    take(spare);
    return { ...cut, photoIndexes: [spare, ...cut.photoIndexes.filter((i) => i !== spare)] };
  });
}

/** 저장된 값 정리 (올린 사진이 없으면 "내 사진"은 빈 자리) */
export function normalizeCutSource(value: unknown, photoCount: number): CutSource {
  if (value === 'blank') return 'blank';
  if (value === 'own') return photoCount > 0 ? 'own' : 'blank';
  return 'ai';
}

/** 맨 위 사진 자리가 비어 있으면 움직이는 컷을 만들 수 없다 */
export const effectiveHeroMotion = (motion: HeroMotion, heroSource: CutSource | null): HeroMotion =>
  heroSource && heroSource !== 'blank' ? motion : 'off';

export const estimateCostUsd = (aiCutCount: number, motion: HeroMotion) =>
  aiCutCount * MEDIA_COST.aiImageUsd + (motion === 'video' ? HERO_VIDEO_USD : 0);

/** 0.62 → "약 870원" */
export function formatCost(usd: number) {
  if (usd <= 0) return '추가 비용 없음';
  const krw = Math.max(10, Math.round((usd * MEDIA_COST.krwPerUsd) / 10) * 10);
  return `약 ${krw.toLocaleString('ko-KR')}원`;
}

/** 장면이 겹치지 않도록 기획 AI에 주는 농수산물 연출 장면 예시 */
export const SCENE_IDEAS: Record<string, string[]> = {
  agri: ['산지·밭/바다 풍경 속 상품', '갓 수확한 모습(바구니·상자)', '단면·속살 클로즈업', '물방울 맺힌 신선함', '식탁 위 플레이팅', '요리 재료로 쓰인 모습', '선물 포장·박스 구성', '보관·손질 방법'],
  default: ['깔끔한 배경의 정면 컷', '사용 장면', '디테일 클로즈업', '구성품 펼침', '선물 포장', '생활 공간 속 연출'],
};

export const sceneIdeas = (categoryId: string) => SCENE_IDEAS[categoryId] ?? SCENE_IDEAS.default;

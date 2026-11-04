import type { FrameNode } from '../frames/tree';
import { buildDesignTemplates, type DesignTemplate } from './designTemplates';
import { buildPatternTemplates } from './patterns';
import { PART2_ORDER, part1Of, part2SortKeyOf } from './part2Taxonomy';

/**
 * 기본 제공 템플릿 — 모두 초안 생성과 같은 레이아웃 엔진(canvas.ts)으로 그린다
 * (`_image` = 상품 사진 자리, 숨김 `prompt` = 문구 작성 가이드, 팔레트 색은 colorVar로 연결)
 *
 * Figma 동기화를 하면 이 목록 뒤에 Figma 템플릿이 추가된다.
 */
export interface TemplateSeed {
  slug: string;
  part1: string;
  part2: string;
  part2SortKey: number;
  frame: FrameNode;
}

export { PART2_ORDER, DRAFT_PART2_ORDER } from './part2Taxonomy';

/** 레이아웃 엔진으로 만든 템플릿 → 구성 순서 정보를 붙인 시드 */
function toSeeds(templates: DesignTemplate[]): TemplateSeed[] {
  return templates.map(({ slug, part2, frame }) => ({
    slug,
    part1: part1Of(part2),
    part2,
    part2SortKey: part2SortKeyOf(part2),
    frame,
  }));
}

/** 기본 템플릿 구성이 바뀌면 올려서 저장소에 다시 반영한다 */
export const BUILTIN_VERSION = 8;

export function buildBuiltinTemplates(): TemplateSeed[] {
  return [
    // 디자인 스타일 5종 × 레이아웃 16종
    ...toSeeds(buildDesignTemplates()),
    // 구성 8개 × 배치 10종 × 스킨 2종
    ...toSeeds(buildPatternTemplates()),
  ];
}

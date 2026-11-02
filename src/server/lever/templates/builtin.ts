import type { FrameNode } from '../frames/tree';
import { buildDesignTemplates, type DesignTemplate } from './designTemplates';
import { buildPatternTemplates } from './patterns';

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

/** 구성 순서 (초안 프로젝트는 part2별로 1개씩 이 순서대로 만든다) */
export const PART2_ORDER = [
  { part1: '도입', part2: '메인 비주얼' },
  { part1: '공감', part2: '문제 제기' },
  { part1: '공감', part2: '호기심 유발' },
  { part1: '설득', part2: '핵심 포인트' },
  { part1: '설득', part2: '상품 특징' },
  { part1: '정보', part2: '상세 정보' },
  { part1: '신뢰', part2: '고객 후기' },
  { part1: '마무리', part2: '구매 안내' },
] as const;

const sortKeyOf = (part2: string) => PART2_ORDER.findIndex((p) => p.part2 === part2) + 1;

/** 레이아웃 엔진으로 만든 템플릿 → 구성 순서 정보를 붙인 시드 */
function toSeeds(templates: DesignTemplate[]): TemplateSeed[] {
  return templates.map(({ slug, part2, frame }) => {
    const part = PART2_ORDER.find((p) => p.part2 === part2) ?? PART2_ORDER[3];
    return { slug, ...part, part2SortKey: sortKeyOf(part.part2), frame };
  });
}

/** 기본 템플릿 구성이 바뀌면 올려서 저장소에 다시 반영한다 */
export const BUILTIN_VERSION = 7;

export function buildBuiltinTemplates(): TemplateSeed[] {
  return [
    // 디자인 스타일 5종 × 레이아웃 16종
    ...toSeeds(buildDesignTemplates()),
    // 구성 8개 × 배치 10종 × 스킨 2종
    ...toSeeds(buildPatternTemplates()),
  ];
}

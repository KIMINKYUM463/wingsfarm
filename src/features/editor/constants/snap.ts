/**
 * 스냅 가이드라인 관련 상수
 */

/** 스냅이 활성화되는 거리 (픽셀) - 이 거리 내로 가까워지면 자석처럼 붙음 */
export const SNAP_OFFSET = 5;

/** 가이드라인 스타일 */
export const GUIDELINE_STYLE = {
  stroke: 'rgb(0, 161, 255)',
  strokeWidth: 1,
  dash: [4, 6],
} as const;

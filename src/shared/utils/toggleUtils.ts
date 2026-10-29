import { TOGGLE_STATES } from '@/shared/constants/ui/toggles';
import { ToggleState } from '@/shared/types/ui/toggles';

// 더보기/편집 상태들 (스택 기반 네비게이션 사용)
export const MORE_VIEW_STATES = [
  TOGGLE_STATES.BLOCK_MORE,
  TOGGLE_STATES.IMAGE_STYLE_MORE,
  TOGGLE_STATES.MODEL_SHOT_MORE,
  TOGGLE_STATES.SHAPE_MORE,
  TOGGLE_STATES.SHAPE_EDIT,
  TOGGLE_STATES.LINE_EDIT,
  TOGGLE_STATES.GRAPHIC_EDIT,
] as const;

// 더보기 상태인지 확인
export const isMoreView = (tool: ToggleState): boolean => {
  return MORE_VIEW_STATES.includes(tool as any);
};

// 현재 툴이 어느 부모 툴에 속하는지 확인
export const getParentTool = (tool: ToggleState): string | null => {
  if (tool === TOGGLE_STATES.BLOCK_MORE) return 'TEMPLATE';
  if (tool === TOGGLE_STATES.IMAGE_STYLE_MORE) return 'IMAGE';
  if (tool === TOGGLE_STATES.MODEL_SHOT_MORE) return 'IMAGE'; // 모델샷도 IMAGE의 하위
  if (tool === TOGGLE_STATES.SHAPE_MORE) return 'SHAPE';
  return null;
};

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import type { IconName } from '@/shared/ui/Icon';
import { useCanvasDataStore } from '@/features/editor/store/useCanvasDataStore';
import { useFrameCrud } from './useFrameCrud';
import { useFrameOrder } from './useFrameOrder';
import { useFrameMeta } from './useFrameMeta';

/**
 * 프레임 조작 관련 모든 비즈니스 로직을 제공하는 통합 훅
 *
 * 책임:
 * - 프레임 CRUD 작업 (삭제, 이동, 복제, 추가)
 * - 서버 동기화 (프레임 API 호출)
 * - 스크롤 동작 통합
 * - useCanvasDataStore와 직접 상호작용
 *
 * @param frameId - 대상 프레임 ID (선택적, 동적으로 사용 가능)
 */
export const useFrameActions = (frameId?: string) => {
  const params = useParams();
  const projectId = params?.id as string;

  const { handleDelete, handleDuplicate, handleActivateGhost, handleApplyTemplate, isApplyingTemplate } = useFrameCrud({
    projectId,
    frameId,
  });

  const { handleMoveUp, handleMoveDown, handleReorder } = useFrameOrder({
    projectId,
    frameId,
  });

  const { handleRename, handleFillChange, handleHeightChange } = useFrameMeta({
    projectId,
    frameId,
  });

  // 맨 위/아래 active 프레임 체크 (ghost 제외)
  const frames = useCanvasDataStore((state) => state.frames);
  const activeFrames = useMemo(() => frames.filter((f) => f.status === 'active'), [frames]);
  const isFirstActive = activeFrames[0]?.id === frameId;
  const isLastActive = activeFrames[activeFrames.length - 1]?.id === frameId;

  // UI 구성: IconToggleGroup items 배열
  const frameActionItems = useMemo(
    () => [
      {
        iconName: 'content_copy' as IconName,
        onClick: () => handleDuplicate(),
        tooltip: '페이지 복제',
      },
      {
        iconName: 'north' as IconName,
        onClick: () => handleMoveUp(),
        disabled: isFirstActive,
        iconColor: isFirstActive ? 'var(--color-gray-200)' : undefined,
        tooltip: '위로 이동',
      },
      {
        iconName: 'south' as IconName,
        onClick: () => handleMoveDown(),
        disabled: isLastActive,
        iconColor: isLastActive ? 'var(--color-gray-200)' : undefined,
        tooltip: '아래로 이동',
      },
      {
        iconName: 'delete' as IconName,
        onClick: () => handleDelete({ source: 'canvas' }),
        tooltip: '페이지 삭제',
      },
    ],
    [handleDuplicate, handleMoveUp, handleMoveDown, handleDelete, isFirstActive, isLastActive],
  );

  return {
    handleDelete,
    handleMoveUp,
    handleMoveDown,
    handleReorder,
    handleDuplicate,
    handleActivateGhost,
    handleApplyTemplate,
    handleRename,
    handleFillChange,
    handleHeightChange,
    frameActionItems,
    isApplyingTemplate,
  };
};

// 개별 훅도 export (필요시 직접 사용 가능)
export { useFrameCrud } from './useFrameCrud';
export { useFrameOrder } from './useFrameOrder';
export { useFrameMeta } from './useFrameMeta';

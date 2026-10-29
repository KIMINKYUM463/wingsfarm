'use client';

import { forwardRef } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { KonvaFrameElement } from '@/shared/types/konva';
import { useCanvasDataStore } from '@/features/editor/store/useCanvasDataStore';
import FrameListItem from './FrameListItem';

interface SortableFrameListItemProps {
  frame: KonvaFrameElement;
  /** 뷰포트 중앙에 위치한 프레임 (인디케이터가 가리키는 프레임) */
  isCentered: boolean;
  /** 활성 프레임 여부 (false = ghost 프레임) */
  isActiveFrame: boolean;
  /** 프레임 삭제 핸들러 (활성 프레임) */
  onDelete: () => void;
  /** Ghost 프레임 활성화 핸들러 */
  onActivate: () => void;
  /** 프레임으로 스크롤 이동 핸들러 */
  onScrollToFrame: () => void;
}

/**
 * Sortable 래퍼 컴포넌트
 * useSortable 훅으로 드래그 상태를 관리하고 FrameListItem에 전달
 */
const SortableFrameListItem = forwardRef<HTMLLIElement, SortableFrameListItemProps>(
  ({ frame, isCentered, isActiveFrame, onDelete, onActivate, onScrollToFrame }, forwardedRef) => {
    const activatingFrameId = useCanvasDataStore((state) => state.activatingFrameId);
    const duplicatingFrameId = useCanvasDataStore((state) => state.duplicatingFrameId);
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
      id: frame.id,
      // ghost도 순서 변경 가능
    });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition: transition ?? 'transform 200ms cubic-bezier(0.25, 1, 0.5, 1)',
      opacity: isDragging ? 0.5 : 1,
    };

    return (
      <li ref={forwardedRef} className="pl-6">
        <FrameListItem
          ref={setNodeRef}
          style={style}
          frameName={frame.name}
          part2={frame.part2}
          isCentered={isCentered}
          isDragging={isDragging}
          isActiveFrame={isActiveFrame || activatingFrameId === frame.id}
          isLoading={activatingFrameId === frame.id || duplicatingFrameId === frame.id}
          onDelete={onDelete}
          onActivate={onActivate}
          onScrollToFrame={onScrollToFrame}
          dragHandleProps={{ ...attributes, ...listeners }}
        />
      </li>
    );
  },
);

SortableFrameListItem.displayName = 'SortableFrameListItem';

export default SortableFrameListItem;

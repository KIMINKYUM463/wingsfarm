'use client';

import { useState, useMemo, useCallback } from 'react';
import { clsx } from 'clsx';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useCanvasDataStore } from '@/features/editor/store/useCanvasDataStore';
import { useFrameListScroll } from '@/features/editor/hooks/useFrameListScroll';
import { useFrameActions } from '@/features/editor/hooks/frame';
import { useScrollToElement } from '@/features/editor/hooks/useScrollToElement';
import SortableFrameListItem from './SortableFrameListItem';
import FrameListItem from './FrameListItem';
import Button from '@/shared/ui/Button/Button';
import Icon from '@/shared/ui/Icon';
import Empty from '@/shared/ui/Empty';

const VERTICAL_LINE_BOTTOM = 24; // 세로선 bottom 위치 (px)

/**
 * 프레임 목록 패널 (오른쪽 사이드바)
 */
export default function FrameListPanel() {
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const frames = useCanvasDataStore((state) => state.frames);
  const isInitialized = useCanvasDataStore((state) => state.isInitialized);
  const hasFrames = frames.length > 0;

  // 스크롤 추적 및 인디케이터 위치 계산
  const { currentFrameId, indicatorTop, liRefs } = useFrameListScroll(frames);

  // 프레임 액션 (재정렬, 삭제, 활성화)
  const { handleReorder, handleDelete, handleActivateGhost } = useFrameActions();

  // 프레임으로 스크롤 이동
  const { scrollToFrameById } = useScrollToElement();

  // DnD 센서 설정
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px 이동 후 드래그 시작 (클릭과 구분)
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // 프레임 ID 배열 (SortableContext용)
  const frameIds = useMemo(() => frames.map((f) => f.id), [frames]);

  // 드래그 중인 프레임
  const activeFrame = useMemo(() => frames.find((f) => f.id === activeId), [frames, activeId]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveId(null);
      const { active, over } = event;

      if (!over || active.id === over.id) return;

      const oldIndex = frames.findIndex((f) => f.id === active.id);
      const newIndex = frames.findIndex((f) => f.id === over.id);

      if (oldIndex === -1 || newIndex === -1) return;

      handleReorder(active.id as string, oldIndex, newIndex);
    },
    [frames, handleReorder],
  );

  // 컨텐츠 렌더링
  const renderContent = () => {
    // 초기화 전: 아무것도 표시하지 않음
    if (!isInitialized) return null;

    // 프레임 없음: 빈 상태 표시
    if (!hasFrames) {
      return <Empty texts={['프레임이 없습니다']} textClassName="description" />;
    }

    // 프레임 있음: 실제 목록
    return (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <nav className="relative flex flex-col gap-3.5 pb-6 bg-white">
          {/* 세로 연결선 */}
          <div
            className="absolute left-2 w-px bg-gray-200 -translate-x-1/2"
            style={{ top: 0, bottom: VERTICAL_LINE_BOTTOM }}
            aria-hidden="true"
          />

          {/* 시작/끝 점 */}
          <div
            className="absolute left-2 w-1 h-1 rounded-full bg-gray-200 -translate-x-1/2 top-0"
            aria-hidden="true"
          />
          <div
            className="absolute left-2 w-1 h-1 rounded-full bg-gray-200 -translate-x-1/2"
            style={{ bottom: VERTICAL_LINE_BOTTOM }}
            aria-hidden="true"
          />

          {/* 활성 프레임 인디케이터 */}
          <div
            className="absolute left-2 w-4 h-4 rounded-full bg-(--color-point)/50 flex-center z-10 transition-all duration-300 -translate-x-1/2"
            style={{ top: `${indicatorTop}px` }}
            aria-hidden="true"
          >
            <div className="w-2 h-2 rounded-full bg-(--color-point)" />
          </div>

          {/* 프레임 목록 */}
          <SortableContext items={frameIds} strategy={verticalListSortingStrategy}>
            <ul className="contents">
              {frames.map((frame, index) => (
                <SortableFrameListItem
                  key={frame.id}
                  frame={frame}
                  isCentered={frame.id === currentFrameId}
                  isActiveFrame={frame.status === 'active'}
                  onDelete={() => handleDelete({ frameId: frame.id, source: 'panel' })}
                  onActivate={() => handleActivateGhost(frame.id)}
                  onScrollToFrame={() => scrollToFrameById(frame.id)}
                  ref={(el: HTMLLIElement | null) => {
                    liRefs.current[index] = el;
                  }}
                />
              ))}
            </ul>
          </SortableContext>
        </nav>

        {/* 드래그 오버레이 (고스트) */}
        <DragOverlay>
          {activeFrame && (
            <FrameListItem frameName={activeFrame.name} part2={activeFrame.part2} isDragging />
          )}
        </DragOverlay>
      </DndContext>
    );
  };

  return (
    <aside
      data-tour="editor-sections"
      className="fixed z-40 bg-white rounded-lg flex flex-col overflow-hidden"
      style={{
        right: 'var(--right-sidebar-gap)',
        width: 'var(--right-sidebar-w)',
        top: 'calc(var(--header-h) + 1rem)',
        maxHeight: 'calc(100vh - var(--header-h) - 7.5rem)',
      }}
    >
      {/* 헤더 */}
      <header className={clsx('bg-white', isExpanded && hasFrames && 'pb-2')}>
        <Button
          className="flex-center-between w-full py-4 px-5 rounded-lg hover:outline outline-(--color-point) hover:-outline-offset-1"
          onClick={() => setIsExpanded(!isExpanded)}
          type="button"
        >
          <h2 className="p-bold">구성 목록</h2>
          <Icon
            name="keyboard_arrow_up"
            className={clsx('transition-transform', !isExpanded && 'rotate-180')}
          />
        </Button>
      </header>

      {/* 프레임 목록 */}
      {isExpanded && (
        <div
          className="flex-1 min-h-0 px-5 bg-white overflow-y-auto"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {renderContent()}
        </div>
      )}
    </aside>
  );
}

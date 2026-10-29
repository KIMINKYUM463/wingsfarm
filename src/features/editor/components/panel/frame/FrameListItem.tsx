'use client';

import { forwardRef, type CSSProperties } from 'react';
import { clsx } from 'clsx';
import IconButton from '@/shared/ui/Button/IconButton';
import Skeleton from '@/shared/ui/Skeleton/Skeleton';
import {
  DEFAULT_FRAME_NAME,
  DEFAULT_PART2,
} from '@/features/editor/components/toolbox/FrameToolbox';

interface FrameListItemProps {
  frameName: string;
  part2?: string;
  /** 뷰포트 중앙에 위치한 프레임 (인디케이터가 가리키는 프레임) */
  isCentered?: boolean;
  isDragging?: boolean;
  /** 활성 프레임 여부 (false = ghost 프레임) */
  isActiveFrame?: boolean;
  /** 로딩 상태 (낙관적 업데이트 시 스켈레톤 표시) */
  isLoading?: boolean;
  /** 프레임 삭제 핸들러 (활성 프레임) */
  onDelete?: () => void;
  /** Ghost 프레임 활성화 핸들러 */
  onActivate?: () => void;
  /** 프레임으로 스크롤 이동 핸들러 */
  onScrollToFrame?: () => void;
  dragHandleProps?: Record<string, unknown>;
  style?: CSSProperties;
}

/**
 * 프레임 목록 아이템
 *
 * @description
 * - 드래그 핸들 + 프레임 정보 표시
 * - part2 (예: "문제 제기") + frameName 표시
 * - 활성 상태는 좌측 세로 연결선의 동그라미로 표시
 */
const FrameListItem = forwardRef<HTMLElement, FrameListItemProps>(
  (
    {
      frameName,
      part2,
      isCentered = false,
      isDragging = false,
      isActiveFrame = true,
      isLoading = false,
      onDelete,
      onActivate,
      onScrollToFrame,
      dragHandleProps,
      style,
    },
    ref,
  ) => {
    const getPart2Style = () => {
      if (!isActiveFrame) return 'text-gray-200 p';
      if (isCentered) return 'text-(--color-point) p-bold';
      return 'text-gray-400 p';
    };

    return (
      <article
        ref={ref}
        style={style}
        className={clsx(
          'flex justify-between transition-shadow',
          isDragging && 'rounded-lg bg-white p-2 shadow-lg',
        )}
      >
        <div className={clsx('flex', isActiveFrame ? 'items-start' : 'items-center')}>
          <IconButton
            icon="drag_indicator"
            iconWidth={20}
            iconHeight={20}
            iconColor="var(--color-gray-400)"
            className="cursor-grab touch-none rounded p-1 transition-colors hover:bg-gray-50 active:cursor-grabbing active:bg-gray-100"
            aria-label="프레임 순서 변경"
            {...dragHandleProps}
          />
        </div>
        {/* 호버 영역: 텍스트 + 액션 버튼 */}
        <div className="group flex min-w-0 flex-1 items-center justify-between">
          <button
            type="button"
            onClick={onScrollToFrame}
            className="group/scroll min-w-0 flex-1 text-left"
          >
            <span
              className={clsx(
                'block content-center truncate pl-1',
                isActiveFrame ? 'py-1' : 'py-3',
                'transition-colors group-hover/scroll:text-gray-300 group-active/scroll:text-gray-200',
                getPart2Style(),
              )}
            >
              {part2 || DEFAULT_PART2}
            </span>
            {isActiveFrame &&
              (isLoading ? (
                <Skeleton variant="text" width={130} height={16} bg="gray-50" className="ml-1" />
              ) : (
                <p className="description truncate text-gray-300 transition-colors">
                  {frameName || DEFAULT_FRAME_NAME}
                </p>
              ))}
          </button>
          {/* 활성 프레임: 삭제 버튼 (로딩 중 숨김) */}
          {isActiveFrame && !isLoading && (
            <IconButton
              icon="delete"
              className="shrink-0 rounded-lg p-2.75 text-gray-400 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-gray-50 active:bg-gray-100"
              iconHeight={20}
              iconWidth={20}
              onClick={onDelete}
              aria-label="프레임 삭제"
            />
          )}
          {/* Ghost 프레임: 추가 버튼 */}
          {!isActiveFrame && (
            <IconButton
              icon="add"
              className="shrink-0 rounded-lg p-2.75 text-gray-400 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-gray-50 active:bg-gray-100"
              iconHeight={20}
              iconWidth={20}
              onClick={onActivate}
              aria-label="프레임 추가"
            />
          )}
        </div>
      </article>
    );
  },
);

FrameListItem.displayName = 'FrameListItem';

export default FrameListItem;

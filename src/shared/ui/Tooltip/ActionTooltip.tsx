'use client';

import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

// ============================================================================
// Types
// ============================================================================

export type TooltipDirection = 'top' | 'bottom' | 'left' | 'right';

type TriggerElement = React.ReactElement<{
  ref?: React.Ref<HTMLElement>;
  onMouseEnter?: (e: React.MouseEvent) => void;
  onMouseLeave?: (e: React.MouseEvent) => void;
  onFocus?: (e: React.FocusEvent) => void;
  onBlur?: (e: React.FocusEvent) => void;
  disabled?: boolean;
}>;

interface ActionTooltipProps {
  /** 툴팁에 표시할 텍스트 */
  content: string;
  /** 툴팁이 나타날 방향 */
  direction?: TooltipDirection;
  /** 트리거 요소 (단일 React element) */
  children: TriggerElement;
  /** 툴팁과 트리거 사이 간격 (px) */
  offset?: number;
  /** 비활성화 여부 */
  disabled?: boolean;
}

interface Position {
  x: number;
  y: number;
}

// ============================================================================
// Constants
// ============================================================================

/** 뷰포트 패딩 (px) - 화면 가장자리 여백 */
const VIEWPORT_PADDING = 8;

/** 툴팁 방향별 transform 값 */
const TRANSFORM_MAP: Record<TooltipDirection, string> = {
  top: 'translate(-50%, -100%)',
  bottom: 'translate(-50%, 0)',
  left: 'translate(-100%, -50%)',
  right: 'translate(0, -50%)',
};

// ============================================================================
// Utils
// ============================================================================

/** display: contents 등으로 인해 크기가 0인 경우 자식 요소의 rect 반환 */
const getValidRect = (element: HTMLElement): DOMRect | null => {
  const rect = element.getBoundingClientRect();

  // 유효한 크기면 바로 반환
  if (rect.width > 0 && rect.height > 0) return rect;

  // display: contents인 경우 첫 번째 자식 탐색
  const firstChild = element.firstElementChild;
  if (!(firstChild instanceof HTMLElement)) return null;

  const childRect = firstChild.getBoundingClientRect();
  return childRect.width > 0 && childRect.height > 0 ? childRect : null;
};

/** 방향에 따른 기본 위치 계산 */
const getBasePosition = (
  rect: DOMRect,
  direction: TooltipDirection,
  offset: number,
): Position => {
  const { top, left, width, height } = rect;
  const centerX = left + width / 2;
  const centerY = top + height / 2;

  const positionMap: Record<TooltipDirection, Position> = {
    top: { x: centerX, y: top - offset },
    bottom: { x: centerX, y: top + height + offset },
    left: { x: left - offset, y: centerY },
    right: { x: left + width + offset, y: centerY },
  };

  return positionMap[direction];
};

/** 뷰포트 경계 내로 값 클램프 */
const clampToViewport = (
  value: number,
  halfSize: number,
  viewportSize: number,
): number => {
  const min = halfSize + VIEWPORT_PADDING;
  const max = viewportSize - halfSize - VIEWPORT_PADDING;
  return Math.max(min, Math.min(max, value));
};

/** 뷰포트 경계를 벗어나지 않도록 위치 조정 */
const adjustPositionForViewport = (
  position: Position,
  tooltipRect: DOMRect | null,
  direction: TooltipDirection,
): Position => {
  if (!tooltipRect) return position;

  const { x, y } = position;
  const isHorizontalDirection = direction === 'top' || direction === 'bottom';

  // 수평 방향(top/bottom)이면 x축 조정, 수직 방향(left/right)이면 y축 조정
  if (isHorizontalDirection) {
    return {
      x: clampToViewport(x, tooltipRect.width / 2, window.innerWidth),
      y,
    };
  }

  return {
    x,
    y: clampToViewport(y, tooltipRect.height / 2, window.innerHeight),
  };
};

/** ref 병합 - children의 기존 ref와 내부 ref 모두 호출 */
const mergeRef = (
  node: HTMLElement | null,
  internalRef: { current: HTMLElement | null },
  externalRef: React.Ref<HTMLElement> | undefined,
): void => {
  internalRef.current = node;

  if (!externalRef) return;

  if (typeof externalRef === 'function') {
    externalRef(node);
    return;
  }

  if (typeof externalRef === 'object' && 'current' in externalRef) {
    (externalRef as { current: HTMLElement | null }).current = node;
  }
};

// ============================================================================
// Component
// ============================================================================

const ActionTooltip = ({
  content,
  direction = 'top',
  children,
  offset = 0,
  disabled = false,
}: ActionTooltipProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 });
  const [isMounted, setIsMounted] = useState(false);

  const triggerRef = useRef<HTMLElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  // SSR 대응
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // 위치 계산
  const calculatePosition = useCallback(() => {
    if (!triggerRef.current) return;

    const rect = getValidRect(triggerRef.current);
    if (!rect) return;

    const basePosition = getBasePosition(rect, direction, offset);
    const tooltipRect = tooltipRef.current?.getBoundingClientRect() ?? null;
    const adjustedPosition = adjustPositionForViewport(basePosition, tooltipRect, direction);

    setPosition(adjustedPosition);
  }, [direction, offset]);

  // 스크롤/리사이즈 시 위치 갱신
  useEffect(() => {
    if (!isVisible) return;

    window.addEventListener('scroll', calculatePosition, { passive: true, capture: true });
    window.addEventListener('resize', calculatePosition, { passive: true });

    return () => {
      window.removeEventListener('scroll', calculatePosition, { capture: true });
      window.removeEventListener('resize', calculatePosition);
    };
  }, [isVisible, calculatePosition]);

  // 툴팁 렌더링 후 뷰포트 조정
  useEffect(() => {
    if (isVisible && tooltipRef.current) {
      calculatePosition();
    }
  }, [isVisible, calculatePosition]);

  // 이벤트 핸들러
  const show = useCallback(() => {
    if (disabled) return;
    calculatePosition();
    setIsVisible(true);
  }, [disabled, calculatePosition]);

  const hide = useCallback(() => setIsVisible(false), []);

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent) => {
      show();
      children.props.onMouseEnter?.(e);
    },
    [show, children.props],
  );

  const handleMouseLeave = useCallback(
    (e: React.MouseEvent) => {
      hide();
      children.props.onMouseLeave?.(e);
    },
    [hide, children.props],
  );

  const handleFocus = useCallback(
    (e: React.FocusEvent) => {
      show();
      children.props.onFocus?.(e);
    },
    [show, children.props],
  );

  const handleBlur = useCallback(
    (e: React.FocusEvent) => {
      hide();
      children.props.onBlur?.(e);
    },
    [hide, children.props],
  );

  const mergeRefs = useCallback(
    (node: HTMLElement | null) => mergeRef(node, triggerRef, children.props.ref),
    [children.props.ref],
  );

  // 스타일
  const tooltipStyle = useMemo(
    (): React.CSSProperties => ({
      position: 'fixed',
      zIndex: 9999,
      left: position.x,
      top: position.y,
      transform: TRANSFORM_MAP[direction],
      animation: 'tooltip-fade-in 150ms ease-out',
    }),
    [position.x, position.y, direction],
  );

  // Early return: 유효하지 않은 children
  if (!isValidElement(children)) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('ActionTooltip: children must be a valid React element');
    }
    return children;
  }

  const eventHandlers = {
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
    onFocus: handleFocus,
    onBlur: handleBlur,
  };

  const tooltip =
    isVisible && isMounted
      ? createPortal(
          <div
            ref={tooltipRef}
            role="tooltip"
            style={tooltipStyle}
            className="description bg-gray-900 text-white px-2.5 py-1.5 rounded-md whitespace-nowrap pointer-events-none"
          >
            {content}
          </div>,
          document.body,
        )
      : null;

  // disabled 요소는 span wrapper로 이벤트 수신
  if (children.props.disabled) {
    return (
      <>
        <span ref={triggerRef} {...eventHandlers} style={{ display: 'contents' }}>
          {children}
        </span>
        {tooltip}
      </>
    );
  }

  return (
    <>
      {cloneElement(children, { ref: mergeRefs, ...eventHandlers })}
      {tooltip}
    </>
  );
};

export default ActionTooltip;

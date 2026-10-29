import { useState, useRef, useCallback, useEffect } from 'react';

export interface UseDelayedHoverOptions {
  /** 딜레이 시간 (ms, 기본: 1000) */
  delay?: number;
  /** 활성화 조건 (기본: true) */
  enabled?: boolean;
}

export interface UseDelayedHoverResult<T = { x: number; y: number }> {
  /** 딜레이 후 호버 활성화 여부 */
  isActive: boolean;
  /** 호버 데이터 (위치 등) */
  data: T | null;
  /** mouseEnter 핸들러 */
  onMouseEnter: (getData: () => T | null) => void;
  /** mouseLeave 핸들러 */
  onMouseLeave: () => void;
  /** ref를 사용한 간편 mouseEnter (getBoundingClientRect 자동 사용) */
  onMouseEnterWithRef: (ref: React.RefObject<HTMLElement | null>) => void;
}

/**
 * 딜레이 호버 훅
 *
 * 일정 시간(기본 1초) 호버 시 활성화되는 상태를 관리합니다.
 * CheckableImage의 툴팁 패턴을 추상화한 훅입니다.
 *
 * @example
 * ```tsx
 * const { isActive, data, onMouseEnterWithRef, onMouseLeave } = useDelayedHover();
 * const ref = useRef<HTMLDivElement>(null);
 *
 * <div
 *   ref={ref}
 *   onMouseEnter={() => onMouseEnterWithRef(ref)}
 *   onMouseLeave={onMouseLeave}
 * >
 *   ...
 * </div>
 * {isActive && data && <Tooltip position={data} />}
 * ```
 */
export const useDelayedHover = <T = { x: number; y: number }>(
  options: UseDelayedHoverOptions = {},
): UseDelayedHoverResult<T> => {
  const { delay = 1000, enabled = true } = options;

  const [isActive, setIsActive] = useState(false);
  const [data, setData] = useState<T | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const onMouseEnter = useCallback(
    (getData: () => T | null) => {
      if (!enabled) return;

      timeoutRef.current = setTimeout(() => {
        const newData = getData();
        if (newData) {
          setData(newData);
          setIsActive(true);
        }
      }, delay);
    },
    [delay, enabled],
  );

  const onMouseLeave = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsActive(false);
    setData(null);
  }, []);

  // ref를 사용한 간편 mouseEnter (위치 데이터 자동 생성)
  const onMouseEnterWithRef = useCallback(
    (ref: React.RefObject<HTMLElement | null>) => {
      onMouseEnter(() => {
        if (!ref.current) return null;
        const rect = ref.current.getBoundingClientRect();
        return { x: rect.right, y: rect.top } as T;
      });
    },
    [onMouseEnter],
  );

  return {
    isActive,
    data,
    onMouseEnter,
    onMouseLeave,
    onMouseEnterWithRef,
  };
};

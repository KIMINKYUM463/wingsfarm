import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

/**
 * 디바운스된 콜백 함수 훅
 *
 * ## 용도
 * - API 호출 디바운스 (자동 저장, 검색 등)
 * - 이벤트 핸들러 최적화
 *
 * ## useDebounce와의 차이
 * - `useDebounce`: 값을 디바운스 (상태, 입력값)
 * - `useDebouncedCallback`: 함수를 디바운스 (API 호출, 이벤트)
 *
 * ## 사용 예시
 * ```tsx
 * const debouncedSave = useDebouncedCallback(
 *   () => saveData(),
 *   { delay: 3000, maxWait: 30000 }
 * );
 *
 * // 연속 호출 시 3초 후 실행, 최대 30초마다 강제 실행
 * onChange(() => debouncedSave());
 * ```
 *
 * @param callback - 실행할 콜백 함수
 * @param options - 디바운스 옵션
 * @returns 디바운스된 콜백 함수
 */
export interface DebouncedCallbackOptions {
  /** 디바운스 딜레이 (ms) */
  delay: number;
  /** 최대 대기 시간 (ms) - 이 시간이 지나면 강제 실행 */
  maxWait?: number;
}

export const useDebouncedCallback = <T extends (...args: unknown[]) => void>(
  callback: T,
  options: DebouncedCallbackOptions,
): T => {
  const { delay, maxWait } = options;

  // 타이머 참조
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const maxWaitTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 최신 콜백 참조 (클로저 문제 방지)
  const callbackRef = useRef(callback);
  useLayoutEffect(() => {
    callbackRef.current = callback;
  });

  // 마지막 호출 시간
  const lastCallTimeRef = useRef<number>(0);
  // 마지막 호출 인자 (maxWait 타이머도 가장 최근 값으로 실행해야 마지막 값이 버려지지 않는다)
  const latestArgsRef = useRef<unknown[]>([]);

  // 클린업 함수
  const cleanup = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (maxWaitTimeoutRef.current) {
      clearTimeout(maxWaitTimeoutRef.current);
      maxWaitTimeoutRef.current = null;
    }
  }, []);

  // 컴포넌트 언마운트 시 클린업
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const debouncedCallback = useCallback(
    (...args: unknown[]) => {
      const now = Date.now();
      latestArgsRef.current = args;

      const flush = () => {
        callbackRef.current(...(latestArgsRef.current as Parameters<T>));
        lastCallTimeRef.current = 0;
        cleanup();
      };

      // 기존 타이머 제거
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // 첫 호출이거나 maxWait이 설정된 경우
      if (maxWait && lastCallTimeRef.current === 0) {
        lastCallTimeRef.current = now;

        // maxWait 타이머 설정
        maxWaitTimeoutRef.current = setTimeout(flush, maxWait);
      }

      // 일반 디바운스 타이머 설정
      timeoutRef.current = setTimeout(flush, delay);
    },
    [delay, maxWait, cleanup],
  ) as T;

  return debouncedCallback;
};

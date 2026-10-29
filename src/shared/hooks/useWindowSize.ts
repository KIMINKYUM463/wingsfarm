'use client';

import { useEffect, useState } from 'react';

interface WindowSize {
  width: number;
  height: number;
}

/**
 * 화면 크기 변경을 감지하는 커스텀 훅
 * throttle을 적용하여 성능 최적화 (기본 100ms 간격)
 * @param throttleMs - throttle 간격 (기본값: 100ms)
 */
const useWindowSize = (throttleMs: number = 100): WindowSize => {
  const [windowSize, setWindowSize] = useState<WindowSize>({
    width: typeof window !== 'undefined' ? window.innerWidth : 1920,
    height: typeof window !== 'undefined' ? window.innerHeight : 1080,
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let timeoutId: NodeJS.Timeout | null = null;
    let lastCallTime = 0;

    const handleResize = () => {
      const now = Date.now();
      const timeSinceLastCall = now - lastCallTime;

      // Throttle: 마지막 호출 후 충분한 시간이 지났으면 즉시 실행
      if (timeSinceLastCall >= throttleMs) {
        lastCallTime = now;
        setWindowSize({
          width: window.innerWidth,
          height: window.innerHeight,
        });
      } else {
        // 아직 시간이 안됐으면 남은 시간 후에 실행 (마지막 이벤트 보장)
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          lastCallTime = Date.now();
          setWindowSize({
            width: window.innerWidth,
            height: window.innerHeight,
          });
        }, throttleMs - timeSinceLastCall);
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [throttleMs]);

  return windowSize;
};

export default useWindowSize;

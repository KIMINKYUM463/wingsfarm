import { useEffect, useRef, useState } from 'react';

interface UseViewportTriggerOptions {
  threshold?: number;
  rootMargin?: string;
  resetOnExit?: boolean;
}

/**
 * 뷰포트 진입/벗어남을 감지하는 커스텀 훅
 * @param options - Intersection Observer 옵션
 * @returns ref와 isVisible 상태
 */
export const useViewportTrigger = (options: UseViewportTriggerOptions = {}) => {
  const {
    threshold = 0.3,
    rootMargin = '0px',
    resetOnExit = true,
  } = options;

  const ref = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        } else if (resetOnExit) {
          setIsVisible(false);
        }
      },
      {
        threshold,
        rootMargin,
      }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [threshold, rootMargin, resetOnExit]);

  return { ref, isVisible };
};
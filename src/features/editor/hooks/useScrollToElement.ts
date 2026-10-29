import { useCallback } from 'react';

interface ScrollOptions {
  behavior?: ScrollBehavior;
  block?: ScrollLogicalPosition;
  delay?: number;
  offset?: number;
}

const DEFAULT_OPTIONS: Required<ScrollOptions> = {
  behavior: 'smooth',
  block: 'center',
  delay: 0,
  offset: 0,
};

const MAX_RETRIES = 20;
const SCROLL_CONTAINER_SELECTOR = '[data-scroll-container]';

/**
 * block 옵션에 따른 스크롤 위치 계산
 */
const calculateScrollPosition = (
  elementTop: number,
  elementHeight: number,
  containerHeight: number,
  block: ScrollLogicalPosition,
): number => {
  switch (block) {
    case 'center':
      return elementTop - containerHeight / 2 + elementHeight / 2;
    case 'end':
      return elementTop - containerHeight + elementHeight;
    case 'start':
    default:
      return elementTop;
  }
};

/**
 * 스크롤 컨테이너 또는 window로 스크롤 실행
 */
const scrollToTarget = (
  element: HTMLElement,
  options: Required<ScrollOptions>,
): void => {
  const { behavior, block, offset } = options;
  const elementRect = element.getBoundingClientRect();

  // offset이 없으면 기본 scrollIntoView 사용
  if (offset === 0) {
    element.scrollIntoView({ behavior, block, inline: 'center' });
    return;
  }

  const scrollContainer = document.querySelector(SCROLL_CONTAINER_SELECTOR) as HTMLElement | null;

  if (scrollContainer) {
    const containerRect = scrollContainer.getBoundingClientRect();
    const absoluteTop = elementRect.top - containerRect.top + scrollContainer.scrollTop;
    const targetTop = calculateScrollPosition(absoluteTop, elementRect.height, containerRect.height, block) + offset;

    scrollContainer.scrollTo({ top: targetTop, behavior });
  } else {
    const absoluteTop = elementRect.top + window.scrollY;
    const targetTop = calculateScrollPosition(absoluteTop, elementRect.height, window.innerHeight, block) + offset;

    window.scrollTo({ top: targetTop, behavior });
  }
};

/**
 * delay가 있으면 setTimeout으로 감싸서 실행
 */
const withDelay = (fn: () => void, delay: number): void => {
  if (delay > 0) {
    setTimeout(fn, delay);
  } else {
    fn();
  }
};

/**
 * 요소가 렌더링될 때까지 재시도하며 찾기
 */
const findElementWithRetry = (
  selector: string,
  onFound: (element: HTMLElement) => void,
  onNotFound: () => void,
  validateElement?: (element: HTMLElement) => boolean,
): void => {
  let retryCount = 0;

  const tryFind = (): void => {
    const element = document.querySelector(selector) as HTMLElement | null;

    if (element) {
      // 유효성 검사가 있고 통과하지 못하면 재시도
      if (validateElement && !validateElement(element)) {
        if (retryCount++ < MAX_RETRIES) {
          requestAnimationFrame(tryFind);
          return;
        }
      } else {
        onFound(element);
        return;
      }
    }

    // 요소를 찾지 못하면 재시도
    if (retryCount++ < MAX_RETRIES) {
      requestAnimationFrame(tryFind);
    } else {
      onNotFound();
    }
  };

  tryFind();
};

/**
 * 특정 요소로 스크롤하는 훅
 *
 * @example
 * const { scrollToFrameById } = useScrollToElement();
 * scrollToFrameById('frame-123', { offset: -100 });
 */
export const useScrollToElement = () => {
  /**
   * 요소 ID로 스크롤
   */
  const scrollToElementById = useCallback((elementId: string, options: ScrollOptions = {}) => {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    withDelay(() => {
      // Konva 요소 또는 일반 DOM 요소 찾기
      const element =
        (document.querySelector(`[id="${elementId}"]`) as HTMLElement) ||
        document.getElementById(elementId);

      if (element) {
        scrollToTarget(element, opts);
      }
    }, opts.delay);
  }, []);

  /**
   * 프레임 ID로 스크롤 (렌더링 대기 포함)
   */
  const scrollToFrameById = useCallback((frameId: string, options: ScrollOptions = {}) => {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    withDelay(() => {
      findElementWithRetry(
        `[data-frame-id="${frameId}"]`,
        (element) => scrollToTarget(element, opts),
        () => {}, // 실패 시 무시
        (element) => element.getBoundingClientRect().height > 0, // 렌더링 완료 확인
      );
    }, opts.delay);
  }, []);

  /**
   * 프레임 내 특정 좌표로 스크롤
   */
  const scrollToPosition = useCallback(
    (frameId: string, _x: number, y: number, options: ScrollOptions = {}) => {
      const opts = { ...DEFAULT_OPTIONS, ...options };

      withDelay(() => {
        const frame = document.querySelector(`[data-frame-id="${frameId}"]`) as HTMLElement | null;
        if (!frame) return;

        const frameRect = frame.getBoundingClientRect();
        const targetTop = window.scrollY + frameRect.top + y - window.innerHeight / 2;

        window.scrollTo({ top: targetTop, behavior: opts.behavior });
      }, opts.delay);
    },
    [],
  );

  return { scrollToElementById, scrollToFrameById, scrollToPosition };
};

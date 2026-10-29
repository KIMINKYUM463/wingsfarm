import { useEffect, useRef } from 'react';

interface UseInfiniteScrollOptions {
  /** 다음 페이지 존재 여부 */
  hasNextPage: boolean;
  /** 현재 다음 페이지 로딩 중 여부 */
  isFetchingNextPage: boolean;
  /** 다음 페이지 요청 함수 */
  fetchNextPage: () => void;
  /** IntersectionObserver threshold (기본값: 0.1) */
  threshold?: number;
}

/**
 * 무한 스크롤을 위한 IntersectionObserver 훅
 *
 * @example
 * const scrollRef = useInfiniteScroll({
 *   hasNextPage,
 *   isFetchingNextPage,
 *   fetchNextPage,
 * });
 *
 * return (
 *   <>
 *     <List>{...}</List>
 *     <div ref={scrollRef} className="h-10" />
 *   </>
 * );
 */
export const useInfiniteScroll = ({
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  threshold = 0.1,
}: UseInfiniteScrollOptions) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const target = ref.current;
    if (!target || !hasNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold },
    );

    observer.observe(target);

    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, threshold]);

  return ref;
};

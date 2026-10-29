'use client';

import { useState, useEffect } from 'react';
import useWindowSize from './useWindowSize';

/** 태블릿 브레이크포인트 (758px) */
const TABLET_BREAKPOINT = 758;

/**
 * 모바일 여부를 반환하는 훅
 * - 태블릿 브레이크포인트(758px) 미만이면 true
 * - SSR/초기 렌더링: null → 아직 판단 불가
 * - 마운트 후: 실제 뷰포트 기반으로 boolean 반환
 */
const useIsMobile = (): boolean | null => {
  const [isMounted, setIsMounted] = useState(false);
  const { width } = useWindowSize();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // 마운트 전: null 반환 (아직 판단 불가)
  if (!isMounted) return null;

  return width < TABLET_BREAKPOINT;
};

export default useIsMobile;

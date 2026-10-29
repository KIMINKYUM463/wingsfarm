import { useState, useEffect, useRef } from 'react';
import { useCenteredFrame } from './useCenteredFrame';
import type { KonvaFrameElement } from '@/shared/types/konva';

const ACTIVE_INDICATOR_OFFSET = 4; // 활성 인디케이터 offset (px)

/**
 * 프레임 목록 스크롤 추적 훅
 *
 * @description
 * - 메인 캔버스 스크롤 감지로 현재 활성 프레임 추적
 * - 인디케이터 위치 자동 계산
 * - 구성 목록 자동 스크롤
 *
 * @param frames - 전체 프레임 배열
 * @returns currentFrameId, indicatorTop, liRefs
 */
export const useFrameListScroll = (frames: KonvaFrameElement[]) => {
  const [currentFrameId, setCurrentFrameId] = useState<string | null>(null);
  const [indicatorTop, setIndicatorTop] = useState(ACTIVE_INDICATOR_OFFSET);
  const liRefs = useRef<(HTMLLIElement | null)[]>([]);
  const { getCenteredFrame } = useCenteredFrame();

  // active 프레임만 (ghost 제외) - 캔버스에 렌더링된 프레임만 추적
  const activeFrames = frames.filter((f) => f.status === 'active');

  // 1. 메인 캔버스 스크롤 감지로 현재 프레임 추적
  useEffect(() => {
    const handleScroll = () => {
      const centeredFrame = getCenteredFrame(activeFrames);
      if (centeredFrame) {
        setCurrentFrameId(centeredFrame.id);
      }
    };

    // 초기 실행
    handleScroll();

    // 스크롤 이벤트 리스너 등록
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [activeFrames, getCenteredFrame]);

  // 2. 현재 프레임 변경 시 인디케이터 위치 업데이트 + 자동 스크롤
  useEffect(() => {
    const activeFrameIndex = frames.findIndex((f) => f.id === currentFrameId);

    if (activeFrameIndex >= 0 && liRefs.current[activeFrameIndex]) {
      const activeLi = liRefs.current[activeFrameIndex];

      if (activeLi) {
        // 인디케이터 위치 계산 (li의 offsetTop + offset)
        setIndicatorTop(activeLi.offsetTop + ACTIVE_INDICATOR_OFFSET);

        // 구성 목록 자동 스크롤
        activeLi.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest', // 필요한 경우에만 스크롤
          inline: 'nearest',
        });
      }
    }
  }, [currentFrameId, frames]);

  return {
    currentFrameId,
    indicatorTop,
    liRefs,
  };
};

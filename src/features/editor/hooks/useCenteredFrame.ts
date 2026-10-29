import { useCallback } from 'react';
import { KonvaFrameElement } from '@/shared/types/konva';
import { getCenteredFrame as getCenteredFrameUtil } from '@/features/editor/lib/centered-frame';

/**
 * viewport 중심에 가장 가까운 프레임을 찾는 훅
 *
 * @description
 * 일반적인 에디터 서비스(Figma, Framer 등)에서 사용하는 방식으로,
 * 뷰포트 중심점과 프레임 중심점 사이의 거리를 계산하여
 * 가장 가까운 프레임을 "현재 보고 있는 프레임"으로 판단합니다.
 */
export const useCenteredFrame = () => {
  const getCenteredFrame = useCallback(
    (frames: KonvaFrameElement[]): KonvaFrameElement | null => {
      return getCenteredFrameUtil(frames);
    },
    [],
  );

  return { getCenteredFrame };
};

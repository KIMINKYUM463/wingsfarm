'use client';

import { Line } from 'react-konva';
import { useSnapStore } from '@/features/editor/store/useSnapStore';
import { GUIDELINE_STYLE } from '@/features/editor/constants/snap';

interface SnapGuidelinesProps {
  frameId: string;
  frameWidth: number;
  frameHeight: number;
}

/**
 * 스냅 가이드라인 렌더링 컴포넌트
 *
 * - 드래그 중에만 표시
 * - 현재 프레임에만 표시
 * - V(세로선): x 좌표에 수직선
 * - H(가로선): y 좌표에 수평선
 */
export const SnapGuidelines = ({ frameId, frameWidth, frameHeight }: SnapGuidelinesProps) => {
  const guides = useSnapStore((state) => state.guides);
  const activeFrameId = useSnapStore((state) => state.activeFrameId);

  // 현재 프레임이 아니면 렌더링 안 함
  if (activeFrameId !== frameId || guides.length === 0) {
    return null;
  }

  return (
    <>
      {guides.map((guide, index) => {
        if (guide.orientation === 'V') {
          // 세로선: x 고정, y는 프레임 전체
          return (
            <Line
              key={`v-${index}`}
              points={[guide.lineGuide, 0, guide.lineGuide, frameHeight]}
              stroke={GUIDELINE_STYLE.stroke}
              strokeWidth={GUIDELINE_STYLE.strokeWidth}
              dash={[...GUIDELINE_STYLE.dash]}
              listening={false}
            />
          );
        } else {
          // 가로선: y 고정, x는 프레임 전체
          return (
            <Line
              key={`h-${index}`}
              points={[0, guide.lineGuide, frameWidth, guide.lineGuide]}
              stroke={GUIDELINE_STYLE.stroke}
              strokeWidth={GUIDELINE_STYLE.strokeWidth}
              dash={[...GUIDELINE_STYLE.dash]}
              listening={false}
            />
          );
        }
      })}
    </>
  );
};

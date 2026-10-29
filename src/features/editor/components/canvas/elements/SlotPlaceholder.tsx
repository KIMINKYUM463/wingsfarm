'use client';

import React from 'react';
import { Group, Rect, Text } from 'react-konva';
import ImagePlaceholder from './ImagePlaceholder';

interface SlotPlaceholderProps {
  x: number;
  y: number;
  width: number;
  height: number;
  /** true: 사진을 아직 안 넣은 빈 자리 / false: 사진 불러오는 중 */
  blank: boolean;
}

const GUIDE_COLOR = '#9CA3AF';

/**
 * 사진 자리 표시
 * - 불러오는 중: 작은 아이콘
 * - 빈 자리: 큰 아이콘 + 점선 테두리 + 안내 문구 (`_blank-guide`는 다운로드할 때 숨긴다 → 연회색 박스와 아이콘만 남음)
 */
const SlotPlaceholder = React.memo<SlotPlaceholderProps>(({ x, y, width, height, blank }) => {
  const showGuide = blank && width >= 200 && height >= 140;
  const size = showGuide ? 48 : 28;
  const centerX = x + width / 2;
  const iconY = y + height / 2 - size / 2 - (showGuide ? 22 : 0);
  return (
    <>
      {blank && (
        <Group name="_blank-guide" listening={false}>
          <Rect x={x + 6} y={y + 6} width={width - 12} height={height - 12} stroke={GUIDE_COLOR} strokeWidth={2} dash={[10, 8]} cornerRadius={8} />
          {showGuide && (
            <>
              <Text x={x} y={iconY + size + 14} width={width} align="center" text="사진을 넣어 주세요" fontSize={18} fontStyle="bold" fill="#6B7280" />
              <Text x={x} y={iconY + size + 40} width={width} align="center" text="클릭해서 내 사진 넣기 · ✦ AI로 만들기" fontSize={14} fill={GUIDE_COLOR} />
            </>
          )}
        </Group>
      )}
      <ImagePlaceholder x={centerX - size / 2} y={iconY} size={size} />
    </>
  );
});

SlotPlaceholder.displayName = 'SlotPlaceholder';

export default SlotPlaceholder;

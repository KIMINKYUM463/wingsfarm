'use client';

import IconButton from '@/shared/ui/Button/IconButton';
import { useRef } from 'react';
import FontForm from '@/features/editor/components/panel/text/FontForm';
import OutlineForm from '@/features/editor/components/panel/text/OutlineForm';
import ShadowForm from '@/features/editor/components/panel/text/ShadowForm';
import { SliderField, ToolSectionLayout } from '@/features/editor/components/panel/common';
import { useSelectedElement } from '@/features/editor/hooks/useSelectedElement';
import { useActiveFrames } from '@/features/editor/store/useCanvasDataStore';
import { useElementStore } from '@/features/editor/store/useElementStore';
import { useCenteredFrame } from '@/features/editor/hooks/useCenteredFrame';
import { useScrollToElement } from '@/features/editor/hooks/useScrollToElement';
import { useDebouncedCallback } from '@/shared/hooks/useDebouncedCallback';

/** 디바운스 딜레이 (ms) */
const DEBOUNCE_DELAY = 150;
/** 슬라이더용 throttle 간격 (ms) */
const THROTTLE_INTERVAL = 50;

const TextTool = () => {
  // textElements: 선택된 요소 + 그룹 내부 텍스트 포함
  const { textElements } = useSelectedElement();
  const activeFrames = useActiveFrames();
  const { addTextToFrame, updateElement } = useElementStore();
  const { getCenteredFrame } = useCenteredFrame();
  const { scrollToPosition } = useScrollToElement();

  // textElements ref (디바운스 콜백에서 최신 elements 참조)
  const textElementsRef = useRef(textElements);
  textElementsRef.current = textElements;

  // 불투명도 변경 핸들러 - throttle 적용 (드래그 중에도 반영)
  const handleOpacityChange = useDebouncedCallback(
    ((opacity: number) => {
      if (textElementsRef.current.length === 0) return;

      const konvaOpacity = opacity / 100;
      textElementsRef.current.forEach((el) => {
        updateElement(el.id, { opacity: konvaOpacity });
      });
    }) as (opacity: unknown) => void,
    { delay: DEBOUNCE_DELAY, maxWait: THROTTLE_INTERVAL },
  ) as (opacity: number) => void;
  const handleAddText = () => {
    if (activeFrames.length === 0) return;

    // viewport 중심에 가장 가까운 active 프레임 찾기
    const centeredFrame = getCenteredFrame(activeFrames);
    if (!centeredFrame) return;

    addTextToFrame(centeredFrame.id);

    // 텍스트가 추가될 위치 (프레임 중앙)로 스크롤
    // DOM 업데이트를 기다린 후 스크롤
    setTimeout(() => {
      const centerX = (centeredFrame.width ?? 860) / 2;
      const centerY = (centeredFrame.height ?? 1080) / 2;
      scrollToPosition(centeredFrame.id, centerX, centerY, {
        behavior: 'smooth',
        delay: 100,
      });
    }, 100);
  };

  return (
    <ToolSectionLayout
      title="텍스트"
      body={
        <IconButton
          type="button"
          className="btn-primary w-full mb-6"
          icon="add"
          text="텍스트 상자 추가"
          textClassName="p-bold title-1"
          onClick={handleAddText}
        />
      }
    >
      {textElements.length > 0 && (
        <>
          <FontForm elements={textElements} />
          <SliderField
            title="불투명도"
            min={0}
            max={100}
            value={Math.round((textElements[0].opacity ?? 1) * 100)}
            step={1}
            onChange={handleOpacityChange}
          />
          <OutlineForm elements={textElements} />
          <ShadowForm elements={textElements} />
        </>
      )}
    </ToolSectionLayout>
  );
};
export default TextTool;

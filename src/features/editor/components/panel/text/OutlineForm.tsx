'use client';

import { useCallback, useMemo, useRef } from 'react';
import EqualColumnsRow from '@/shared/ui/EqualColumnsRow';
import {
  CommonColor,
  CommonSize,
  EffectSection,
} from '@/features/editor/components/panel/common';
import { KonvaTextElement } from '@/shared/types/konva';
import { useElementStore } from '@/features/editor/store/useElementStore';
import { useDebouncedCallback } from '@/shared/hooks/useDebouncedCallback';

/** 속성별 기본값 */
const DEFAULT_VALUES = {
  stroke: '#000000',
  strokeWidth: 1, // 체크 시 적용될 기본값
} as const;

/** 디바운스 딜레이 (ms) */
const DEBOUNCE_DELAY = 150;

/** 다중 선택 시 공통 속성 계산 */
const getCommonValue = <K extends keyof KonvaTextElement>(
  elements: KonvaTextElement[],
  key: K,
  defaultValue?: unknown,
): KonvaTextElement[K] | undefined => {
  if (elements.length === 0) return undefined;

  const getValue = (el: KonvaTextElement) => el[key] ?? defaultValue;
  const first = getValue(elements[0]);
  const allSame = elements.every((el) => getValue(el) === first);

  return allSame ? (first as KonvaTextElement[K]) : undefined;
};

interface OutlineFormProps {
  elements: KonvaTextElement[];
}

const OutlineForm = ({ elements }: OutlineFormProps) => {
  const { updateElement } = useElementStore();

  // elements ref (디바운스 콜백에서 최신 elements 참조)
  const elementsRef = useRef(elements);
  elementsRef.current = elements;

  // 공통 속성 계산
  const commonStroke = useMemo(
    () => getCommonValue(elements, 'stroke', DEFAULT_VALUES.stroke),
    [elements],
  );
  const commonStrokeWidth = useMemo(
    () => getCommonValue(elements, 'strokeWidth', 0),
    [elements],
  );

  // 효과 활성화 여부: strokeWidth > 0이면 활성화
  const isEnabled = (commonStrokeWidth ?? 0) > 0;

  // 요소 선택/토글 변경 시 리마운트를 위한 key
  const elementsKey = `${elements.map((el) => el.id).join('-')}-${isEnabled}`;

  // 디바운스된 store 업데이트
  const debouncedUpdateAll = useDebouncedCallback(
    ((updates: Partial<KonvaTextElement>) => {
      elementsRef.current.forEach((el) => updateElement(el.id, updates));
    }) as (updates: unknown) => void,
    { delay: DEBOUNCE_DELAY },
  ) as (updates: Partial<KonvaTextElement>) => void;

  // 체크박스 토글 핸들러 (즉시 반영)
  const handleToggle = useCallback(
    (enabled: boolean) => {
      const updates = enabled
        ? { stroke: commonStroke ?? DEFAULT_VALUES.stroke, strokeWidth: DEFAULT_VALUES.strokeWidth }
        : { strokeWidth: 0 };
      elementsRef.current.forEach((el) => updateElement(el.id, updates));
    },
    [updateElement, commonStroke],
  );

  const handleStrokeChange = useCallback(
    (color: string) => {
      // 색상 변경 시 strokeWidth가 0이면 1로 자동 설정 (외곽선을 보이게 하려는 의도)
      const currentWidth = elementsRef.current[0]?.strokeWidth ?? 0;
      if (currentWidth === 0) {
        debouncedUpdateAll({ stroke: color, strokeWidth: DEFAULT_VALUES.strokeWidth });
      } else {
        debouncedUpdateAll({ stroke: color });
      }
    },
    [debouncedUpdateAll],
  );

  const handleStrokeWidthChange = useCallback(
    (width: number) => {
      debouncedUpdateAll({ strokeWidth: width });
    },
    [debouncedUpdateAll],
  );

  return (
    <EffectSection
      key={elementsKey}
      title="외곽선"
      isEnabled={isEnabled}
      onToggle={handleToggle}
      defaultOpen={isEnabled}
    >
      <EqualColumnsRow>
        <CommonColor
          key={`color-${elementsKey}`}
          label="색상"
          initialColor={commonStroke ?? DEFAULT_VALUES.stroke}
          onChange={handleStrokeChange}
        />
        <CommonSize
          key={`width-${elementsKey}`}
          initialValue={commonStrokeWidth ?? 0}
          onChange={handleStrokeWidthChange}
          min={0}
        />
      </EqualColumnsRow>
    </EffectSection>
  );
};

export default OutlineForm;

'use client';

import { useCallback, useMemo, useRef } from 'react';
import EqualColumnsRow from '@/shared/ui/EqualColumnsRow';
import {
  CommonColor,
  EffectSection,
  NumericInputField,
  SliderField,
} from '@/features/editor/components/panel/common';
import { KonvaTextElement } from '@/shared/types/konva';
import { useElementStore } from '@/features/editor/store/useElementStore';
import { useDebouncedCallback } from '@/shared/hooks/useDebouncedCallback';

/** 속성별 기본값 */
const DEFAULT_VALUES = {
  shadowColor: '#000000',
  shadowBlur: 5, // 체크 시 적용될 기본값
  shadowOffsetX: 0,
  shadowOffsetY: 0,
  shadowOpacity: 1,
} as const;

/** 디바운스 딜레이 (ms) */
const DEBOUNCE_DELAY = 150;
/** 슬라이더용 throttle 간격 (ms) */
const THROTTLE_INTERVAL = 50;

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

interface ShadowFormProps {
  elements: KonvaTextElement[];
}

const ShadowForm = ({ elements }: ShadowFormProps) => {
  const { updateElement } = useElementStore();

  // elements ref (디바운스 콜백에서 최신 elements 참조)
  const elementsRef = useRef(elements);
  elementsRef.current = elements;

  // 공통 속성 계산
  const commonShadowColor = useMemo(
    () => getCommonValue(elements, 'shadowColor', DEFAULT_VALUES.shadowColor),
    [elements],
  );
  const commonShadowBlur = useMemo(
    () => getCommonValue(elements, 'shadowBlur', 0),
    [elements],
  );
  const commonShadowOffsetX = useMemo(
    () => getCommonValue(elements, 'shadowOffsetX', 0),
    [elements],
  );
  const commonShadowOffsetY = useMemo(
    () => getCommonValue(elements, 'shadowOffsetY', 0),
    [elements],
  );
  const commonShadowOpacity = useMemo(
    () => getCommonValue(elements, 'shadowOpacity', DEFAULT_VALUES.shadowOpacity),
    [elements],
  );

  // 효과 활성화 여부: blur > 0 또는 offset이 0이 아니면 활성화
  const isEnabled =
    (commonShadowBlur ?? 0) > 0 ||
    (commonShadowOffsetX ?? 0) !== 0 ||
    (commonShadowOffsetY ?? 0) !== 0;

  // 디바운스된 store 업데이트
  const debouncedUpdateAll = useDebouncedCallback(
    ((updates: Partial<KonvaTextElement>) => {
      elementsRef.current.forEach((el) => updateElement(el.id, updates));
    }) as (updates: unknown) => void,
    { delay: DEBOUNCE_DELAY },
  ) as (updates: Partial<KonvaTextElement>) => void;

  // 슬라이더용 throttle (드래그 중에도 반영)
  const throttledUpdateAll = useDebouncedCallback(
    ((updates: Partial<KonvaTextElement>) => {
      elementsRef.current.forEach((el) => updateElement(el.id, updates));
    }) as (updates: unknown) => void,
    { delay: DEBOUNCE_DELAY, maxWait: THROTTLE_INTERVAL },
  ) as (updates: Partial<KonvaTextElement>) => void;

  // 체크박스 토글 핸들러 (즉시 반영)
  const handleToggle = useCallback(
    (enabled: boolean) => {
      const updates = enabled
        ? {
            shadowColor: commonShadowColor ?? DEFAULT_VALUES.shadowColor,
            shadowBlur: DEFAULT_VALUES.shadowBlur,
            shadowOffsetX: DEFAULT_VALUES.shadowOffsetX,
            shadowOffsetY: DEFAULT_VALUES.shadowOffsetY,
            shadowOpacity: DEFAULT_VALUES.shadowOpacity,
            shadowEnabled: true,
          }
        : {
            shadowBlur: 0,
            shadowOffsetX: 0,
            shadowOffsetY: 0,
            shadowEnabled: false,
          };
      elementsRef.current.forEach((el) => updateElement(el.id, updates));
    },
    [updateElement, commonShadowColor],
  );

  const handleShadowColorChange = useCallback(
    (color: string) => {
      // 색상 변경 시 그림자가 안 보이면(blur, offset 모두 0) 기본 blur 적용
      const el = elementsRef.current[0];
      const hasNoShadow =
        (el?.shadowBlur ?? 0) === 0 &&
        (el?.shadowOffsetX ?? 0) === 0 &&
        (el?.shadowOffsetY ?? 0) === 0;

      if (hasNoShadow) {
        debouncedUpdateAll({ shadowColor: color, shadowBlur: DEFAULT_VALUES.shadowBlur, shadowEnabled: true });
      } else {
        debouncedUpdateAll({ shadowColor: color, shadowEnabled: true });
      }
    },
    [debouncedUpdateAll],
  );

  const handleShadowBlurChange = useCallback(
    (blur: number) => {
      debouncedUpdateAll({ shadowBlur: blur, shadowEnabled: true });
    },
    [debouncedUpdateAll],
  );

  const handleShadowOffsetXChange = useCallback(
    (offsetX: number) => {
      debouncedUpdateAll({ shadowOffsetX: offsetX, shadowEnabled: true });
    },
    [debouncedUpdateAll],
  );

  const handleShadowOffsetYChange = useCallback(
    (offsetY: number) => {
      debouncedUpdateAll({ shadowOffsetY: offsetY, shadowEnabled: true });
    },
    [debouncedUpdateAll],
  );

  const handleShadowOpacityChange = useCallback(
    (opacity: number) => {
      // 0~100 → 0~1 변환
      const konvaOpacity = opacity / 100;
      throttledUpdateAll({ shadowOpacity: konvaOpacity, shadowEnabled: true });
    },
    [throttledUpdateAll],
  );

  // 요소 선택/토글 변경 시 리마운트를 위한 key
  const elementsKey = `${elements.map((el) => el.id).join('-')}-${isEnabled}`;

  return (
    <EffectSection
      key={elementsKey}
      title="그림자"
      isEnabled={isEnabled}
      onToggle={handleToggle}
      defaultOpen={isEnabled}
    >
      <EqualColumnsRow>
        <CommonColor
          key={`color-${elementsKey}`}
          label="색상"
          initialColor={commonShadowColor ?? DEFAULT_VALUES.shadowColor}
          onChange={handleShadowColorChange}
        />
        <NumericInputField
          key={`blur-${elementsKey}`}
          label="블러"
          defaultValue={commonShadowBlur ?? 0}
          suffix="px"
          onChange={handleShadowBlurChange}
        />
      </EqualColumnsRow>
      <EqualColumnsRow>
        <NumericInputField
          key={`offsetX-${elementsKey}`}
          label="가로"
          defaultValue={commonShadowOffsetX ?? 0}
          onChange={handleShadowOffsetXChange}
        />
        <NumericInputField
          key={`offsetY-${elementsKey}`}
          label="세로"
          defaultValue={commonShadowOffsetY ?? 0}
          onChange={handleShadowOffsetYChange}
        />
      </EqualColumnsRow>
      <SliderField
        title="불투명도"
        min={0}
        max={100}
        step={1}
        value={Math.round((commonShadowOpacity ?? DEFAULT_VALUES.shadowOpacity) * 100)}
        onChange={handleShadowOpacityChange}
      />
    </EffectSection>
  );
};

export default ShadowForm;

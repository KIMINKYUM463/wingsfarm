'use client';
import EqualColumnsRow from '@/shared/ui/EqualColumnsRow';
import {
  CommonSize as FontSize,
  CommonIconToggleGroup,
  ToolFormLayout,
} from '@/features/editor/components/panel/common';
import { useCallback, useMemo, useRef } from 'react';
import { useElementStore } from '@/features/editor/store/useElementStore';
import { useCanvasDataStore } from '@/features/editor/store/useCanvasDataStore';
import { useSelectedElement } from '@/features/editor/hooks/useSelectedElement';
import { KonvaTextElement } from '@/shared/types/konva';
import TextColorPicker from './TextColorPicker';
import FontCombobox from './FontCombobox';
import { useFontLoader } from '@/features/editor/hooks/useFontLoader';
import { useDebouncedCallback } from '@/shared/hooks/useDebouncedCallback';

const ALIGN_TYPES = ['left', 'center', 'right'] as const;

/** 디바운스 딜레이 (ms) */
const DEBOUNCE_DELAY = 150;

/** 속성별 기본값 (undefined일 때 실제로 적용되는 값) */
const DEFAULT_VALUES: Partial<Record<keyof KonvaTextElement, unknown>> = {
  fontWeight: 400,
  fontSize: 16,
  align: 'left',
  fontStyle: 'normal',
  fill: '#000000',
};

/** 텍스트 요소의 표시 색상 추출 (fill 또는 그라데이션 첫 번째 색상) */
const getDisplayColor = (element: KonvaTextElement): string => {
  // fill이 있으면 그대로 사용
  if (element.fill) return element.fill;

  // 그라데이션인 경우 첫 번째 색상 추출
  if (element.fillPriority === 'linear-gradient' && element.fillLinearGradientColorStops) {
    const stops = element.fillLinearGradientColorStops;
    // [0, 'rgba(...)', 0.28, 'rgba(...)', ...] 형태에서 첫 번째 색상(인덱스 1)
    if (stops.length >= 2 && typeof stops[1] === 'string') {
      return stops[1];
    }
  }

  return '#000000';
};

/** 다중 선택 시 공통 속성 계산 (모두 같으면 값 반환, 다르면 undefined) */
const getCommonValue = <K extends keyof KonvaTextElement>(
  elements: KonvaTextElement[],
  key: K,
): KonvaTextElement[K] | undefined => {
  if (elements.length === 0) return undefined;

  // 기본값 적용하여 비교 (undefined vs 400 같은 케이스 방지)
  const defaultValue = DEFAULT_VALUES[key];
  const getValue = (el: KonvaTextElement) => el[key] ?? defaultValue;

  const first = getValue(elements[0]);
  const allSame = elements.every((el) => getValue(el) === first);

  return allSame ? (first as KonvaTextElement[K]) : undefined;
};

interface FontFormProps {
  elements: KonvaTextElement[];
}

const FontForm = ({ elements }: FontFormProps) => {
  const { updateElement } = useElementStore();
  const { loadFontWithWeight } = useFontLoader();
  const getFrameById = useCanvasDataStore((state) => state.getFrameById);
  const { elements: allSelectedElements } = useSelectedElement();

  // elements ref (디바운스 콜백에서 최신 elements 참조)
  const elementsRef = useRef(elements);
  elementsRef.current = elements;

  // 첫 번째 요소 (기준값, 정렬 등에 사용)
  const firstElement = elements[0];

  // 공통 속성 계산 (다중 선택 시 다르면 undefined)
  const commonFont = useMemo(() => getCommonValue(elements, 'fontFamily'), [elements]);
  const commonWeight = useMemo(() => getCommonValue(elements, 'fontWeight'), [elements]);
  const commonAlign = useMemo(() => getCommonValue(elements, 'align'), [elements]);
  const commonFontStyle = useMemo(() => getCommonValue(elements, 'fontStyle'), [elements]);
  const commonFontSize = useMemo(() => getCommonValue(elements, 'fontSize'), [elements]);
  const commonFill = useMemo(() => getCommonValue(elements, 'fill'), [elements]);
  const commonBackgroundColor = useMemo(
    () => getCommonValue(elements, 'backgroundColor'),
    [elements],
  );

  // 모든 선택된 요소에 일괄 적용 (즉시 실행 - 토글 등)
  const updateAll = useCallback(
    (updates: Partial<KonvaTextElement>) => {
      elements.forEach((el) => updateElement(el.id, updates));
    },
    [elements, updateElement],
  );

  // 디바운스된 store 업데이트 (연속 입력 - color 등)
  const debouncedUpdateAll = useDebouncedCallback(
    ((updates: Partial<KonvaTextElement>) => {
      elementsRef.current.forEach((el) => updateElement(el.id, updates));
    }) as (updates: unknown) => void,
    { delay: DEBOUNCE_DELAY },
  ) as (updates: Partial<KonvaTextElement>) => void;

  // fontSize 변경 시 width/height도 비례 스케일링 (Transformer 크기 동기화)
  const debouncedFontSizeChange = useDebouncedCallback(
    ((newSize: number) => {
      const roundedSize = Math.round(newSize);
      elementsRef.current.forEach((el) => {
        const oldSize = el.fontSize || 16;
        const scale = roundedSize / oldSize;
        updateElement(el.id, {
          fontSize: roundedSize,
          width: Math.round((el.width ?? 100) * scale),
          height: Math.round((el.height ?? 20) * scale),
        });
      });
    }) as (newSize: unknown) => void,
    { delay: DEBOUNCE_DELAY },
  ) as (newSize: number) => void;

  const handleFontSelect = useCallback(
    async (family: string, weight: number) => {
      await loadFontWithWeight(family, weight);
      updateAll({ fontFamily: family, fontWeight: weight });
    },
    [loadFontWithWeight, updateAll],
  );

  const handleAlignClick = useCallback(
    (index: number) => {
      updateAll({ align: ALIGN_TYPES[index] });
    },
    [updateAll],
  );

  // Bold: fontWeight 토글 (400 ↔ 700)
  const handleBoldClick = useCallback(async () => {
    // 혼합 상태면 모두 700으로, 아니면 토글
    const currentWeight = commonWeight ?? 400;
    const newWeight = currentWeight >= 700 ? 400 : 700;
    await loadFontWithWeight(firstElement.fontFamily, newWeight);
    updateAll({ fontWeight: newWeight });
  }, [commonWeight, firstElement.fontFamily, loadFontWithWeight, updateAll]);

  // Italic: fontStyle 토글
  const handleItalicClick = useCallback(() => {
    const hasItalic = commonFontStyle?.includes('italic') ?? false;
    const newStyle = hasItalic ? 'normal' : 'italic';
    updateAll({ fontStyle: newStyle });
  }, [commonFontStyle, updateAll]);

  // 현재 상태 (undefined면 혼합 상태)
  const currentAlign = commonAlign || 'left';
  const isBold = commonWeight !== undefined ? commonWeight >= 700 : false;
  const isItalic = commonFontStyle?.includes('italic') ?? false;
  const isMixedAlign = commonAlign === undefined;

  // 정렬 함수
  // - 단일 선택: 프레임 기준 정렬
  // - 다중 선택: 전체 선택 영역 기준 정렬 (텍스트만 이동)
  const alignElements = useCallback(
    (axis: 'x' | 'y', position: 'start' | 'center' | 'end') => {
      if (elements.length === 0) return;

      // 단일 텍스트 & 단일 선택: 프레임 기준 정렬
      if (elements.length === 1 && allSelectedElements.length === 1) {
        const element = elements[0];
        const frame = getFrameById(element.rootId);
        const frameSize = axis === 'x' ? frame?.width : frame?.height;
        const elementSize = axis === 'x' ? element.width : element.height;
        if (!frameSize || !elementSize) return;

        const positionMap = {
          start: 0,
          center: (frameSize - elementSize) / 2,
          end: frameSize - elementSize,
        };
        updateElement(element.id, { [axis]: positionMap[position] });
        return;
      }

      // 다중 선택: 전체 선택 영역(allSelectedElements) 기준 bounding box 계산
      const positions = allSelectedElements.map((el) => ({
        pos: axis === 'x' ? el.x : el.y,
        size: axis === 'x' ? (el.width ?? 0) : (el.height ?? 0),
      }));

      const minPos = Math.min(...positions.map((p) => p.pos));
      const maxEnd = Math.max(...positions.map((p) => p.pos + p.size));

      // 텍스트 요소만 정렬
      elements.forEach((element) => {
        const elementSize = axis === 'x' ? (element.width ?? 0) : (element.height ?? 0);
        let newPos: number;

        switch (position) {
          case 'start':
            newPos = minPos;
            break;
          case 'center':
            newPos = (minPos + maxEnd - elementSize) / 2;
            break;
          case 'end':
            newPos = maxEnd - elementSize;
            break;
        }

        updateElement(element.id, { [axis]: newPos });
      });
    },
    [elements, allSelectedElements, getFrameById, updateElement],
  );

  return (
    <ToolFormLayout title="폰트">
      <FontCombobox
        currentFamily={firstElement.fontFamily}
        currentWeight={commonWeight ?? 400}
        isFamilyMixed={commonFont === undefined}
        isWeightMixed={commonWeight === undefined}
        onSelect={handleFontSelect}
        className="w-full"
      />

      <EqualColumnsRow className="relative">
        <FontSize
          initialValue={commonFontSize ? Math.round(commonFontSize) : undefined}
          onChange={debouncedFontSizeChange}
        />
        <TextColorPicker
          currentColor={getDisplayColor(firstElement)}
          isMixed={commonFill === undefined}
          onColorChange={(color) => debouncedUpdateAll({ fill: color, fillPriority: 'color' })}
          currentHighlightColor={firstElement.backgroundColor}
          isHighlightMixed={commonBackgroundColor === undefined && elements.some((el) => el.backgroundColor)}
          onHighlightChange={(color) => debouncedUpdateAll({ backgroundColor: color })}
        />
      </EqualColumnsRow>

      <EqualColumnsRow>
        <CommonIconToggleGroup
          items={ALIGN_TYPES.map((align) => ({
            iconName: `format_align_${align}`,
            onClick: handleAlignClick,
            isActive: !isMixedAlign && currentAlign === align,
            tooltip:
              align === 'left' ? '왼쪽 정렬' : align === 'center' ? '가운데 정렬' : '오른쪽 정렬',
          }))}
        />
        <CommonIconToggleGroup
          items={[
            { iconName: 'format_bold', onClick: handleBoldClick, isActive: isBold, tooltip: '굵게' },
            {
              iconName: 'format_italic',
              onClick: handleItalicClick,
              isActive: isItalic,
              tooltip: '기울임',
            },
          ]}
        />
      </EqualColumnsRow>

      {/* 프레임 기준 수평/수직 정렬 */}
      <EqualColumnsRow>
        <CommonIconToggleGroup
          items={[
            {
              iconName: 'align_horizontal_left',
              onClick: () => alignElements('x', 'start'),
              isActive: false,
              tooltip: '페이지 왼쪽에 맞춤',
            },
            {
              iconName: 'align_horizontal_center',
              onClick: () => alignElements('x', 'center'),
              isActive: false,
              tooltip: '페이지 가운데에 맞춤',
            },
            {
              iconName: 'align_horizontal_right',
              onClick: () => alignElements('x', 'end'),
              isActive: false,
              tooltip: '페이지 오른쪽에 맞춤',
            },
          ]}
        />
        <CommonIconToggleGroup
          items={[
            {
              iconName: 'align_vertical_top',
              onClick: () => alignElements('y', 'start'),
              isActive: false,
              tooltip: '페이지 맨 위에 맞춤',
            },
            {
              iconName: 'align_vertical_center',
              onClick: () => alignElements('y', 'center'),
              isActive: false,
              tooltip: '페이지 가운데에 맞춤',
            },
            {
              iconName: 'align_vertical_bottom',
              onClick: () => alignElements('y', 'end'),
              isActive: false,
              tooltip: '페이지 맨 아래에 맞춤',
            },
          ]}
        />
      </EqualColumnsRow>
    </ToolFormLayout>
  );
};

export default FontForm;

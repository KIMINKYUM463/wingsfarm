'use client';

import { useCallback, useMemo, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import EqualColumnsRow from '@/shared/ui/EqualColumnsRow';
import {
  CommonColor,
  CommonIconToggleGroup,
  NumericInputField,
  ToolFormLayout,
} from '@/features/editor/components/panel/common';
import { KonvaLineTypeElement, isKonvaLineTypeElement } from '@/shared/types/konva';
import { useElementStore } from '@/features/editor/store/useElementStore';
import { useCanvasDataStore } from '@/features/editor/store/useCanvasDataStore';
import { useSelectedElement } from '@/features/editor/hooks/useSelectedElement';
import { useDebouncedCallback } from '@/shared/hooks/useDebouncedCallback';

/** 디바운스 딜레이 (ms) */
const DEBOUNCE_DELAY = 150;

/** 속성별 기본값 */
const DEFAULT_VALUES = {
  stroke: '#000000',
  strokeWidth: 1,
  opacity: 1,
} as const;

/** 다중 선택 시 공통 속성 계산 */
const getCommonValue = <K extends keyof KonvaLineTypeElement>(
  elements: KonvaLineTypeElement[],
  key: K,
  defaultValue?: unknown,
): KonvaLineTypeElement[K] | undefined => {
  if (elements.length === 0) return undefined;

  const getValue = (el: KonvaLineTypeElement) => el[key] ?? defaultValue;
  const first = getValue(elements[0]);
  const allSame = elements.every((el) => getValue(el) === first);

  return allSame ? (first as KonvaLineTypeElement[K]) : undefined;
};

/** Line 요소의 너비 계산 (points 기준) */
const getLineWidth = (element: KonvaLineTypeElement): number => {
  const points = element.points;
  const xs = points.filter((_, i) => i % 2 === 0);
  const width = Math.max(...xs) - Math.min(...xs);
  return Math.max(1, Math.round(width));
};

interface LineEditFormProps {
  elements: KonvaLineTypeElement[];
}

const LineEditForm = ({ elements: initialElements }: LineEditFormProps) => {
  const { updateElement } = useElementStore();
  const getFrameById = useCanvasDataStore((state) => state.getFrameById);
  const { elements: allSelectedElements } = useSelectedElement();

  // 요소 ID 목록
  const elementIds = useMemo(() => initialElements.map((el) => el.id), [initialElements]);

  // 스토어에서 직접 요소 구독 (transform 반영을 위해)
  const elements = useCanvasDataStore(
    useShallow((state) =>
      elementIds
        .map((id) => state.flatElements.get(id))
        .filter((el): el is KonvaLineTypeElement => el !== undefined && isKonvaLineTypeElement(el)),
    ),
  );

  // elements ref (디바운스 콜백에서 최신 elements 참조)
  const elementsRef = useRef(elements);
  elementsRef.current = elements;

  // 첫 번째 요소 (기준값)
  const firstElement = elements[0];

  // 공통 속성 계산
  const commonStroke = useMemo(
    () => getCommonValue(elements, 'stroke', DEFAULT_VALUES.stroke),
    [elements],
  );
  const commonStrokeWidth = useMemo(
    () => getCommonValue(elements, 'strokeWidth', DEFAULT_VALUES.strokeWidth),
    [elements],
  );
  const commonOpacity = useMemo(
    () => getCommonValue(elements, 'opacity', DEFAULT_VALUES.opacity),
    [elements],
  );

  // 너비는 첫 번째 요소 기준 (scale 반영)
  const firstWidth = firstElement
    ? Math.round(getLineWidth(firstElement) * (firstElement.scaleX ?? 1))
    : 1;

  // 디바운스된 store 업데이트
  const debouncedUpdateAll = useDebouncedCallback(
    ((updates: Partial<KonvaLineTypeElement>) => {
      elementsRef.current.forEach((el) => updateElement(el.id, updates));
    }) as (updates: unknown) => void,
    { delay: DEBOUNCE_DELAY },
  ) as (updates: Partial<KonvaLineTypeElement>) => void;

  // 색상 변경 핸들러
  const handleColorChange = useCallback(
    (color: string) => {
      debouncedUpdateAll({ stroke: color });
    },
    [debouncedUpdateAll],
  );

  // 두께 변경 핸들러
  const handleStrokeWidthChange = useCallback(
    (value: number) => {
      debouncedUpdateAll({ strokeWidth: Math.max(1, value) });
    },
    [debouncedUpdateAll],
  );

  // 불투명도 변경 핸들러
  const handleOpacityChange = useCallback(
    (value: number) => {
      const opacity = Math.max(0, Math.min(100, value)) / 100;
      debouncedUpdateAll({ opacity });
    },
    [debouncedUpdateAll],
  );

  // 너비 변경 핸들러 (첫 번째 요소만 적용)
  const handleWidthChange = useCallback(
    (newWidth: number) => {
      if (!firstElement) return;

      const currentWidth = getLineWidth(firstElement);
      if (currentWidth === 0) return;

      const scale = newWidth / currentWidth;
      const points = firstElement.points;

      // x 좌표(짝수 인덱스)에만 scale 적용
      const newPoints = points.map((coord, i) => (i % 2 === 0 ? coord * scale : coord));

      updateElement(firstElement.id, { points: newPoints });
    },
    [firstElement, updateElement],
  );

  // 정렬 함수
  const alignElements = useCallback(
    (axis: 'x' | 'y', position: 'start' | 'center' | 'end') => {
      if (elements.length === 0) return;

      // 단일 Line & 단일 선택: 프레임 기준 정렬
      if (elements.length === 1 && allSelectedElements.length === 1) {
        const element = elements[0];
        const frame = getFrameById(element.rootId);
        const frameSize = axis === 'x' ? frame?.width : frame?.height;

        // Line의 bounding box 계산
        const points = element.points;
        const coords =
          axis === 'x'
            ? points.filter((_, i) => i % 2 === 0)
            : points.filter((_, i) => i % 2 === 1);
        const elementSize = Math.max(...coords) - Math.min(...coords);

        if (!frameSize) return;

        const positionMap = {
          start: 0,
          center: (frameSize - elementSize) / 2,
          end: frameSize - elementSize,
        };
        updateElement(element.id, { [axis]: positionMap[position] });
        return;
      }

      // 다중 선택: 전체 선택 영역 기준 bounding box 계산
      const positions = allSelectedElements.map((el) => ({
        pos: axis === 'x' ? el.x : el.y,
        size: axis === 'x' ? (el.width ?? 0) : (el.height ?? 0),
      }));

      const minPos = Math.min(...positions.map((p) => p.pos));
      const maxEnd = Math.max(...positions.map((p) => p.pos + p.size));

      // Line 요소만 정렬
      elements.forEach((element) => {
        const points = element.points;
        const coords =
          axis === 'x'
            ? points.filter((_, i) => i % 2 === 0)
            : points.filter((_, i) => i % 2 === 1);
        const elementSize = Math.max(...coords) - Math.min(...coords);
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

  if (!firstElement) return null;

  return (
    <ToolFormLayout title="옵션">
      {/* 수평/수직 정렬 */}
      <EqualColumnsRow>
        <CommonIconToggleGroup
          items={[
            {
              iconName: 'align_horizontal_left',
              onClick: () => alignElements('x', 'start'),
              isActive: false,
            },
            {
              iconName: 'align_horizontal_center',
              onClick: () => alignElements('x', 'center'),
              isActive: false,
            },
            {
              iconName: 'align_horizontal_right',
              onClick: () => alignElements('x', 'end'),
              isActive: false,
            },
          ]}
        />
        <CommonIconToggleGroup
          items={[
            {
              iconName: 'align_vertical_top',
              onClick: () => alignElements('y', 'start'),
              isActive: false,
            },
            {
              iconName: 'align_vertical_center',
              onClick: () => alignElements('y', 'center'),
              isActive: false,
            },
            {
              iconName: 'align_vertical_bottom',
              onClick: () => alignElements('y', 'end'),
              isActive: false,
            },
          ]}
        />
      </EqualColumnsRow>

      {/* 두께/너비 */}
      <EqualColumnsRow>
        <NumericInputField
          label="두께"
          defaultValue={commonStrokeWidth ?? DEFAULT_VALUES.strokeWidth}
          min={1}
          onChange={handleStrokeWidthChange}
        />
        <NumericInputField label="너비" value={firstWidth} suffix="px" min={1} onChange={handleWidthChange} />
      </EqualColumnsRow>

      {/* 색상/불투명도 */}
      <EqualColumnsRow>
        <CommonColor
          label="색상"
          initialColor={commonStroke ?? DEFAULT_VALUES.stroke}
          onChange={handleColorChange}
        />
        <NumericInputField
          label="불투명도"
          defaultValue={Math.round((commonOpacity ?? DEFAULT_VALUES.opacity) * 100)}
          suffix="%"
          min={0}
          max={100}
          onChange={handleOpacityChange}
        />
      </EqualColumnsRow>
    </ToolFormLayout>
  );
};

export default LineEditForm;

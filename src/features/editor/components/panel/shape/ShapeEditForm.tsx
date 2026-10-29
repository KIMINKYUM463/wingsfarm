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
import { KonvaShapeElement, isKonvaShapeElement } from '@/shared/types/konva';
import { useElementStore } from '@/features/editor/store/useElementStore';
import { useCanvasDataStore } from '@/features/editor/store/useCanvasDataStore';
import { useSelectedElement } from '@/features/editor/hooks/useSelectedElement';
import { useDebouncedCallback } from '@/shared/hooks/useDebouncedCallback';

/** 디바운스 딜레이 (ms) */
const DEBOUNCE_DELAY = 150;

/** 속성별 기본값 */
const DEFAULT_VALUES = {
  fill: '#D9D9D9',
  opacity: 1,
  width: 100,
  height: 100,
} as const;

/** 다중 선택 시 공통 속성 계산 */
const getCommonValue = <K extends keyof KonvaShapeElement>(
  elements: KonvaShapeElement[],
  key: K,
  defaultValue?: unknown,
): KonvaShapeElement[K] | undefined => {
  if (elements.length === 0) return undefined;

  const getValue = (el: KonvaShapeElement) => el[key] ?? defaultValue;
  const first = getValue(elements[0]);
  const allSame = elements.every((el) => getValue(el) === first);

  return allSame ? (first as KonvaShapeElement[K]) : undefined;
};

/** Shape 요소의 너비 계산 (타입별 처리) */
const getShapeWidth = (element: KonvaShapeElement): number => {
  switch (element.type) {
    case 'circle':
      return element.radius * 2;
    case 'ellipse':
      return element.radiusX * 2;
    case 'star':
      return element.outerRadius * 2;
    case 'regularPolygon':
      return element.radius * 2;
    default:
      return element.width ?? DEFAULT_VALUES.width;
  }
};

/** Shape 요소의 높이 계산 (타입별 처리) */
const getShapeHeight = (element: KonvaShapeElement): number => {
  switch (element.type) {
    case 'circle':
      return element.radius * 2;
    case 'ellipse':
      return element.radiusY * 2;
    case 'star':
      return element.outerRadius * 2;
    case 'regularPolygon':
      return element.radius * 2;
    default:
      return element.height ?? DEFAULT_VALUES.height;
  }
};

interface ShapeEditFormProps {
  elements: KonvaShapeElement[];
}

const ShapeEditForm = ({ elements: initialElements }: ShapeEditFormProps) => {
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
        .filter((el): el is KonvaShapeElement => el !== undefined && isKonvaShapeElement(el)),
    ),
  );

  // elements ref (디바운스 콜백에서 최신 elements 참조)
  const elementsRef = useRef(elements);
  elementsRef.current = elements;

  // 첫 번째 요소 (기준값)
  const firstElement = elements[0];

  // 공통 속성 계산
  const commonFill = useMemo(
    () => getCommonValue(elements, 'fill', DEFAULT_VALUES.fill),
    [elements],
  );
  const commonOpacity = useMemo(
    () => getCommonValue(elements, 'opacity', DEFAULT_VALUES.opacity),
    [elements],
  );

  // 너비/높이는 첫 번째 요소 기준 (다중 선택 시 혼합 상태, scale 반영)
  const firstWidth = firstElement
    ? Math.round(getShapeWidth(firstElement) * (firstElement.scaleX ?? 1))
    : DEFAULT_VALUES.width;
  const firstHeight = firstElement
    ? Math.round(getShapeHeight(firstElement) * (firstElement.scaleY ?? 1))
    : DEFAULT_VALUES.height;

  // 디바운스된 store 업데이트
  const debouncedUpdateAll = useDebouncedCallback(
    ((updates: Partial<KonvaShapeElement>) => {
      elementsRef.current.forEach((el) => updateElement(el.id, updates));
    }) as (updates: unknown) => void,
    { delay: DEBOUNCE_DELAY },
  ) as (updates: Partial<KonvaShapeElement>) => void;

  // 색상 변경 핸들러
  const handleColorChange = useCallback(
    (color: string) => {
      debouncedUpdateAll({ fill: color, fillPriority: 'color' });
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

      const currentWidth = getShapeWidth(firstElement);
      if (currentWidth === 0) return;

      switch (firstElement.type) {
        case 'circle':
          updateElement(firstElement.id, { radius: newWidth / 2 });
          break;
        case 'ellipse':
          updateElement(firstElement.id, { radiusX: newWidth / 2 });
          break;
        case 'star':
          updateElement(firstElement.id, { outerRadius: newWidth / 2 });
          break;
        case 'regularPolygon':
          updateElement(firstElement.id, { radius: newWidth / 2 });
          break;
        default:
          updateElement(firstElement.id, { width: newWidth, scaleX: 1 });
      }
    },
    [firstElement, updateElement],
  );

  // 높이 변경 핸들러 (첫 번째 요소만 적용)
  const handleHeightChange = useCallback(
    (newHeight: number) => {
      if (!firstElement) return;

      const currentHeight = getShapeHeight(firstElement);
      if (currentHeight === 0) return;

      switch (firstElement.type) {
        case 'circle':
          updateElement(firstElement.id, { radius: newHeight / 2 });
          break;
        case 'ellipse':
          updateElement(firstElement.id, { radiusY: newHeight / 2 });
          break;
        case 'star':
          updateElement(firstElement.id, { outerRadius: newHeight / 2 });
          break;
        case 'regularPolygon':
          updateElement(firstElement.id, { radius: newHeight / 2 });
          break;
        default:
          updateElement(firstElement.id, { height: newHeight, scaleY: 1 });
      }
    },
    [firstElement, updateElement],
  );

  // 정렬 함수
  const alignElements = useCallback(
    (axis: 'x' | 'y', position: 'start' | 'center' | 'end') => {
      if (elements.length === 0) return;

      // 단일 Shape & 단일 선택: 프레임 기준 정렬
      if (elements.length === 1 && allSelectedElements.length === 1) {
        const element = elements[0];
        const frame = getFrameById(element.rootId);
        const frameSize = axis === 'x' ? frame?.width : frame?.height;
        const elementSize = axis === 'x' ? getShapeWidth(element) : getShapeHeight(element);
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

      // Shape 요소만 정렬
      elements.forEach((element) => {
        const elementSize = axis === 'x' ? getShapeWidth(element) : getShapeHeight(element);
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

      {/* 너비/높이 */}
      <EqualColumnsRow>
        <NumericInputField
          label="너비"
          value={firstWidth}
          suffix="px"
          min={1}
          onChange={handleWidthChange}
        />
        <NumericInputField
          label="높이"
          value={firstHeight}
          suffix="px"
          min={1}
          onChange={handleHeightChange}
        />
      </EqualColumnsRow>

      {/* 색상/불투명도 */}
      <EqualColumnsRow>
        <CommonColor
          label="색상"
          initialColor={commonFill ?? DEFAULT_VALUES.fill}
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

export default ShapeEditForm;

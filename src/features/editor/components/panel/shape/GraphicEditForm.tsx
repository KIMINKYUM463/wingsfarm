'use client';

import { useCallback, useMemo, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import EqualColumnsRow from '@/shared/ui/EqualColumnsRow';
import {
  CommonIconToggleGroup,
  NumericInputField,
  ToolFormLayout,
} from '@/features/editor/components/panel/common';
import { KonvaRectElement } from '@/shared/types/konva';
import { useElementStore } from '@/features/editor/store/useElementStore';
import { useCanvasDataStore } from '@/features/editor/store/useCanvasDataStore';
import { useSelectedElement } from '@/features/editor/hooks/useSelectedElement';
import { useDebouncedCallback } from '@/shared/hooks/useDebouncedCallback';

/** 디바운스 딜레이 (ms) */
const DEBOUNCE_DELAY = 150;

/** 속성별 기본값 */
const DEFAULT_VALUES = {
  opacity: 1,
  width: 100,
  height: 100,
} as const;

/** 다중 선택 시 공통 속성 계산 */
const getCommonValue = <K extends keyof KonvaRectElement>(
  elements: KonvaRectElement[],
  key: K,
  defaultValue?: unknown,
): KonvaRectElement[K] | undefined => {
  if (elements.length === 0) return undefined;

  const getValue = (el: KonvaRectElement) => el[key] ?? defaultValue;
  const first = getValue(elements[0]);
  const allSame = elements.every((el) => getValue(el) === first);

  return allSame ? (first as KonvaRectElement[K]) : undefined;
};

interface GraphicEditFormProps {
  elements: KonvaRectElement[];
}

const GraphicEditForm = ({ elements: initialElements }: GraphicEditFormProps) => {
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
        .filter((el): el is KonvaRectElement => el !== undefined && el.type === 'rect'),
    ),
  );

  // elements ref (디바운스 콜백에서 최신 elements 참조)
  const elementsRef = useRef(elements);
  elementsRef.current = elements;

  // 첫 번째 요소 (기준값)
  const firstElement = elements[0];

  // 공통 속성 계산
  const commonOpacity = useMemo(
    () => getCommonValue(elements, 'opacity', DEFAULT_VALUES.opacity),
    [elements],
  );

  // 너비/높이는 첫 번째 요소 기준 (스케일 반영)
  const firstWidth = Math.round(
    (firstElement?.width ?? DEFAULT_VALUES.width) * (firstElement?.scaleX ?? 1),
  );
  const firstHeight = Math.round(
    (firstElement?.height ?? DEFAULT_VALUES.height) * (firstElement?.scaleY ?? 1),
  );

  // 비율 보존을 위한 ref (반올림 오차 누적 방지)
  // - 요소 변경 시: 새 비율로 초기화
  // - 트랜스포머 리사이즈 시: 새 비율로 업데이트
  // - 패널 입력 시: 기존 비율 유지 (expectedWidth/Height로 자체 변경 감지)
  const aspectRatioRef = useRef<{
    id: string | undefined;
    ratio: number;
    expectedWidth: number;
    expectedHeight: number;
  }>({
    id: undefined,
    ratio: 1,
    expectedWidth: 0,
    expectedHeight: 0,
  });

  const elementId = firstElement?.id;
  const { id: prevId, expectedWidth, expectedHeight } = aspectRatioRef.current;

  // 패널에서 설정한 값과 일치하면 자체 변경 (비율 업데이트 안 함)
  const isOwnChange = firstWidth === expectedWidth && firstHeight === expectedHeight;
  const isNewElement = elementId !== prevId;

  if ((isNewElement || !isOwnChange) && firstWidth > 1 && firstHeight > 1) {
    aspectRatioRef.current = {
      id: elementId,
      ratio: firstWidth / firstHeight,
      expectedWidth: 0,
      expectedHeight: 0,
    };
  }

  const aspectRatio = aspectRatioRef.current.ratio;

  // 디바운스된 store 업데이트
  const debouncedUpdateAll = useDebouncedCallback(
    ((updates: Partial<KonvaRectElement>) => {
      elementsRef.current.forEach((el) => updateElement(el.id, updates));
    }) as (updates: unknown) => void,
    { delay: DEBOUNCE_DELAY },
  ) as (updates: Partial<KonvaRectElement>) => void;

  // 너비 변경 핸들러 (비율 유지)
  const handleWidthChange = useCallback(
    (value: number) => {
      const newWidth = Math.max(1, value);
      const newHeight = Math.max(1, Math.round(newWidth / aspectRatio));
      // 자체 변경임을 표시 (비율 재계산 방지)
      aspectRatioRef.current.expectedWidth = newWidth;
      aspectRatioRef.current.expectedHeight = newHeight;
      debouncedUpdateAll({ width: newWidth, height: newHeight, scaleX: 1, scaleY: 1 });
    },
    [debouncedUpdateAll, aspectRatio],
  );

  // 높이 변경 핸들러 (비율 유지)
  const handleHeightChange = useCallback(
    (value: number) => {
      const newHeight = Math.max(1, value);
      const newWidth = Math.max(1, Math.round(newHeight * aspectRatio));
      // 자체 변경임을 표시 (비율 재계산 방지)
      aspectRatioRef.current.expectedWidth = newWidth;
      aspectRatioRef.current.expectedHeight = newHeight;
      debouncedUpdateAll({ width: newWidth, height: newHeight, scaleX: 1, scaleY: 1 });
    },
    [debouncedUpdateAll, aspectRatio],
  );

  // 불투명도 변경 핸들러
  const handleOpacityChange = useCallback(
    (value: number) => {
      const opacity = Math.max(0, Math.min(100, value)) / 100;
      debouncedUpdateAll({ opacity });
    },
    [debouncedUpdateAll],
  );

  // 스케일 적용된 크기 계산
  const getScaledSize = (el: KonvaRectElement, axis: 'x' | 'y') => {
    const size = axis === 'x' ? el.width : el.height;
    const scale = axis === 'x' ? (el.scaleX ?? 1) : (el.scaleY ?? 1);
    return size * scale;
  };

  // 정렬 함수
  const alignElements = useCallback(
    (axis: 'x' | 'y', position: 'start' | 'center' | 'end') => {
      if (elements.length === 0) return;

      // 단일 요소 & 단일 선택: 프레임 기준 정렬
      if (elements.length === 1 && allSelectedElements.length === 1) {
        const element = elements[0];
        const frame = getFrameById(element.rootId);
        const frameSize = axis === 'x' ? frame?.width : frame?.height;
        const elementSize = getScaledSize(element, axis);
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
        size: axis === 'x' ? (el.width ?? 0) * ((el as KonvaRectElement).scaleX ?? 1) : (el.height ?? 0) * ((el as KonvaRectElement).scaleY ?? 1),
      }));

      const minPos = Math.min(...positions.map((p) => p.pos));
      const maxEnd = Math.max(...positions.map((p) => p.pos + p.size));

      // 요소 정렬
      elements.forEach((element) => {
        const elementSize = getScaledSize(element, axis);
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

      {/* 불투명도 */}
      <div className="w-1/2 pr-2.25">
        <NumericInputField
          label="불투명도"
          defaultValue={Math.round((commonOpacity ?? DEFAULT_VALUES.opacity) * 100)}
          suffix="%"
          min={0}
          max={100}
          onChange={handleOpacityChange}
        />
      </div>
    </ToolFormLayout>
  );
};

export default GraphicEditForm;

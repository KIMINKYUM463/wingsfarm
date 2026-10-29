/**
 * EditorTransformer.tsx
 * 에디터에서 사용하는 Konva Transformer 컴포넌트
 *
 * ## 특징
 * - 내부에서 선택 상태 구독 (CanvasFrame 리렌더 방지)
 * - 고정된 스타일 설정 (BORDER_STYLES.TRANSFORMER 사용)
 * - 선택된 요소들의 타입에 따른 동적 anchor 설정
 * - 비율 유지(keepRatio) 및 회전 비활성화(rotatable=false)
 */

'use client';

import { useLayoutEffect, useMemo, useEffect } from 'react';
import { Transformer } from 'react-konva';
import Konva from 'konva';
import { useShallow } from 'zustand/react/shallow';
import { BORDER_STYLES } from '@/shared/constants/border';
import { getEnabledAnchors, getKeepRatio, createBoundBoxFunc } from '@/features/editor/utils/transformerUtils';
import { useSelectedItems, useIsMultiSelectionRotating, useSelectionStore, useGroupMode } from '@/features/editor/store/useSelectionStore';
import { useCanvasDataStore } from '@/features/editor/store/useCanvasDataStore';
import { isKonvaContainerElement, KonvaElement } from '@/shared/types/konva';
import { useResizeSnap } from '@/features/editor/hooks/useResizeSnap';
import type { TransformerRef, ElementRefs } from '@/shared/types/konva-editor';

interface EditorTransformerProps {
  frameId: string;
  transformerRef: TransformerRef;
  elementRefs: ElementRefs;
}

/**
 * 에디터용 Transformer 컴포넌트
 *
 * @description
 * - 선택된 요소들의 크기 조정 및 변형을 담당
 * - 내부에서 선택 상태 구독 → 해당 컴포넌트만 리렌더
 * - keepRatio: 비율 유지 활성화
 * - rotatable: 기본 회전 핸들 비활성화 (RotateHandle 사용)
 * - enabledAnchors: 요소 타입에 따라 동적으로 설정
 */
export const EditorTransformer = ({
  frameId,
  transformerRef,
  elementRefs,
}: EditorTransformerProps) => {
  // 내부에서 선택 상태 구독 (CanvasFrame 리렌더 방지)
  const selectedItems = useSelectedItems();
  const isMultiSelectionRotating = useIsMultiSelectionRotating();
  const groupMode = useGroupMode();

  // 현재 프레임에 선택된 요소 필터 (rootId로 확정적 판단 - 타이밍 무관)
  const selectedInThisFrame = useMemo(
    () => selectedItems.filter((item) => item.rootId === frameId).map((item) => item.id),
    [selectedItems, frameId],
  );

  // 선택된 요소만 구독 (전체 flatElements 구독 대신)
  // → 선택되지 않은 요소 변경 시 re-render 방지
  const selectedElements = useCanvasDataStore(
    useShallow((state) => {
      if (selectedInThisFrame.length === 0) return [];
      return selectedInThisFrame
        .map((id) => state.flatElements.get(id))
        .filter((el): el is KonvaElement => el !== undefined);
    }),
  );

  // 선택된 요소의 크기 변경 감지를 위한 키 생성
  // fontSize 변경 등으로 인한 크기 변경 시 Transformer forceUpdate 필요
  const selectedDimensionsKey = useMemo(() => {
    return selectedElements
      .map((el) => `${el.id}:${el.width}:${el.height}`)
      .join('|');
  }, [selectedElements]);

  // 선택된 그룹의 children 변경 감지를 위한 키 생성
  // Konva.Transformer는 Group 내부 변경을 자동으로 추적하지 못함 → forceUpdate 필요
  const selectedGroupChildrenKey = useMemo(() => {
    return selectedElements
      .map((element) => {
        if (isKonvaContainerElement(element)) {
          // 그룹의 children 내용을 키로 사용 (텍스트 변경 등 감지)
          // children 배열의 참조가 변경되면 키도 변경됨
          return element.children
            .map((c) => {
              // 텍스트 요소는 text 속성도 포함
              const text = (c as { text?: string }).text || '';
              return `${c.id}:${text}`;
            })
            .join(',');
        }
        return '';
      })
      .join('|');
  }, [selectedElements]);

  // nodes 동기화 (useLayoutEffect: 페인트 전 실행 → RotateHandle 지연 방지)
  useLayoutEffect(() => {
    const transformer = transformerRef.current;
    if (!transformer) return;

    if (selectedInThisFrame.length > 0) {
      const nodes = selectedInThisFrame
        .map((id) => elementRefs.current.get(id))
        .filter((node): node is Konva.Node => node !== undefined);

      transformer.nodes(nodes);
      transformer.getLayer()?.batchDraw();
    } else {
      transformer.nodes([]);
    }
  }, [transformerRef, selectedInThisFrame, elementRefs]);

  // 요소 크기/내부 변경 시 Transformer 강제 업데이트
  // - selectedDimensionsKey: fontSize 변경으로 인한 크기 변경 감지
  // - selectedGroupChildrenKey: 그룹 내부 변경 감지
  useEffect(() => {
    const transformer = transformerRef.current;
    if (!transformer) return;

    // requestAnimationFrame으로 지연하여 드래그 시작 이벤트가 먼저 처리되도록 함
    // blur → onDragStart 순서에서, onDragStart가 isDragging을 설정한 후 체크
    let cancelled = false;
    const rafId = requestAnimationFrame(() => {
      if (cancelled) return;
      if (!transformer) return;

      const currentIsDragging = useSelectionStore.getState().isDragging;
      if (currentIsDragging) return;

      // 노드가 유효한지 확인 (스테이지에 마운트됨)
      const nodes = transformer.nodes();
      if (nodes.length === 0 || !nodes.every((node) => node?.getStage())) return;

      try {
        transformer.forceUpdate();
        transformer.getLayer()?.batchDraw();
      } catch {
        // 노드가 마운트 해제된 경우 무시 (race condition 방어)
      }
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, [transformerRef, selectedDimensionsKey, selectedGroupChildrenKey]);

  // 다중 선택 또는 컨테이너 모드일 때 shouldOverdrawWholeArea 활성화
  // → 다중 선택: 전체 영역 드래그 지원
  // → 컨테이너 모드: 내부 요소 드래그 방지 (Transformer가 내부 요소 드래그하지 않도록)
  const shouldOverdraw = selectedInThisFrame.length > 1 || groupMode.active;

  // Line/Arrow 타입 요소가 선택되었을 때
  // → padding: 작은 요소가 Transformer 테두리에 가려지는 것 방지
  // → boundBoxFunc: 수평/수직선은 한쪽 dimension이 0이므로 별도 처리 필요
  const isLineType = selectedElements.some(
    (el) => el.type === 'line' || el.type === 'arrow',
  );
  const transformerPadding = isLineType ? 8 : 0;

  // 리사이즈 스냅 (앵커 드래그 시 자석처럼 달라붙음)
  const { anchorDragBoundFunc } = useResizeSnap();

  // 성능 최적화: Transformer props 메모이제이션
  // → Konva는 참조 동등성 체크하므로 매 렌더마다 새 함수 생성 시 불필요한 업데이트 발생
  const enabledAnchors = useMemo(
    () => getEnabledAnchors(selectedInThisFrame, elementRefs),
    [selectedInThisFrame, elementRefs],
  );
  const keepRatio = useMemo(
    () => getKeepRatio(selectedInThisFrame, elementRefs),
    [selectedInThisFrame, elementRefs],
  );
  const boundBoxFunc = useMemo(
    () => createBoundBoxFunc(isLineType),
    [isLineType],
  );

  // 선택된 요소 없으면 빈 Transformer (성능상 항상 렌더링)
  // 다중 선택 회전 시 숨김 (회전하는 selection box overlay로 대체)
  return (
    <Transformer
      name="_selection-ui"
      keepRatio={keepRatio}
      ref={transformerRef}
      visible={!isMultiSelectionRotating}
      borderStroke={BORDER_STYLES.TRANSFORMER.color}
      borderStrokeWidth={BORDER_STYLES.TRANSFORMER.width}
      anchorStroke={BORDER_STYLES.TRANSFORMER.color}
      anchorStrokeWidth={BORDER_STYLES.TRANSFORMER.width}
      enabledAnchors={enabledAnchors}
      boundBoxFunc={boundBoxFunc}
      anchorDragBoundFunc={anchorDragBoundFunc}
      rotatable={false}
      rotateEnabled={false}
      flipEnabled={false}
      shouldOverdrawWholeArea={shouldOverdraw}
      padding={transformerPadding}
    />
  );
};

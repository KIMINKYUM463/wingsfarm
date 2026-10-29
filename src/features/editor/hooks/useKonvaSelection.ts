/**
 * useKonvaSelection.ts
 * Konva 요소 선택 기능 (드래그 영역 선택 + 클릭 선택)
 *
 * ## 책임
 * - 드래그로 영역 선택 (selectionRect)
 * - 단일/다중 클릭 선택 (Shift/Ctrl/Cmd)
 * - Stage 클릭 시 선택 해제
 * - Selection → ToolPanel 연동 (선택 시 적절한 Tool로 전환)
 *
 * ## 사용 예시
 * ```tsx
 * const { selectionRect, handleMouseDown, handleMouseMove, handleMouseUp, handleStageClick } = useKonvaSelection();
 *
 * <Stage
 *   onMouseDown={handleMouseDown}
 *   onMouseMove={handleMouseMove}
 *   onMouseUp={handleMouseUp}
 *   onClick={handleStageClick}
 * >
 *   {selectionRect.visible && <SelectionRect {...selectionRect} />}
 * </Stage>
 * ```
 */

import { useState, useRef, useCallback } from 'react';
import { KonvaEventObject } from 'konva/lib/Node';
import Konva from 'konva';
import { SelectionRect } from '@/shared/types/konva-editor';
import { useCanvasDataStore } from '@/features/editor/store/useCanvasDataStore';
import {
  useSelectionStore,
  useClearSelection,
  type SelectedItem,
} from '@/features/editor/store/useSelectionStore';
import { useToolPanelStore } from '@/features/editor/store/useToolPanelStore';
import { useElementStore } from '@/features/editor/store/useElementStore';
import { getSelectionType } from '@/features/editor/lib/selection-type';
import { TOGGLE_STATES } from '@/shared/constants/ui/toggles';
import {
  isLogicalContainer,
  isNodeInsideGroup,
  findLogicalContainerParent,
} from '@/features/editor/lib/group-utils';
import { getClientRect } from '@/utils/geometry';
import {
  KonvaElement,
  KonvaFrameElement,
  isKonvaFrameElement,
  isKonvaContainerElement,
} from '@/shared/types/konva';

const MIN_DRAG_DISTANCE = 5; // 최소 드래그 거리 (px)
const MAIN_LAYER_NAME = 'main-layer'; // 메인 레이어 이름

/**
 * 요소가 선택 영역과 교차하는지 확인 (그룹은 자식 포함 체크)
 * @param parentOffset 부모의 절대 좌표 (그룹 자식의 상대 좌표를 절대 좌표로 변환)
 */
const intersectsWithBox = (
  element: KonvaElement,
  selBox: { x: number; y: number; width: number; height: number },
  parentOffset = { x: 0, y: 0 },
): boolean => {
  // 절대 좌표로 변환하여 교차 확인
  const absoluteRect = getClientRect({
    ...element,
    x: element.x + parentOffset.x,
    y: element.y + parentOffset.y,
  } as KonvaElement);

  if (Konva.Util.haveIntersection(selBox, absoluteRect)) {
    return true;
  }

  // 그룹 또는 중첩 Frame: 자식 중 하나라도 교차하면 컨테이너 선택
  if (isKonvaContainerElement(element)) {
    const containerOffset = { x: element.x + parentOffset.x, y: element.y + parentOffset.y };
    return element.children.some((child) => intersectsWithBox(child, selBox, containerOffset));
  }

  return false;
};

interface UseKonvaSelectionOptions {
  /** 현재 프레임 ID (드래그 선택 시 해당 프레임만 검사) */
  frameId?: string;
}

/**
 * Konva 요소 선택 기능을 제공하는 훅
 *
 * @param options.frameId 현재 프레임 ID
 * @returns {Object} 선택 영역 상태, 이벤트 핸들러, isDragging ref
 */
export const useKonvaSelection = (options: UseKonvaSelectionOptions = {}) => {
  const { frameId } = options;
  // Selection Store
  const setSelectedItems = useSelectionStore((state) => state.setSelectedItems);
  const selectedItems = useSelectionStore((state) => state.selectedItems);
  const clearSelection = useClearSelection();
  const groupMode = useSelectionStore((state) => state.groupMode);
  const enterGroupMode = useSelectionStore((state) => state.enterGroupMode);
  const exitGroupMode = useSelectionStore((state) => state.exitGroupMode);

  // Tool Panel Store (Selection → Tool 연동)
  const setSelectedTool = useToolPanelStore((state) => state.setSelectedTool);
  const resetTextToggleState = useToolPanelStore((state) => state.resetTextToggleState);

  // Other Stores
  const getElement = useElementStore((state) => state.getElement);

  const [selectionRect, setSelectionRect] = useState<SelectionRect>({
    visible: false,
    x1: 0,
    y1: 0,
    x2: 0,
    y2: 0,
  });

  const isSelecting = useRef<boolean>(false);
  const isDragging = useRef<boolean>(false);
  const mainLayerRef = useRef<Konva.Layer | null>(null); // findOne 캐싱용
  const selectionRectRef = useRef<SelectionRect>(selectionRect); // handleMouseUp 안정화용
  selectionRectRef.current = selectionRect;

  /**
   * 선택 변경 시 Selection Store와 Tool Panel Store 동시 업데이트
   */
  const updateSelection = useCallback(
    (items: SelectedItem[]) => {
      setSelectedItems(items);

      // 선택 해제 시 textToggleState 초기화
      if (items.length === 0) {
        resetTextToggleState();
        return;
      }

      // 요소들을 한 번에 조회 (중복 getElement 호출 방지)
      const elements = items
        .map((item) => getElement(item.id))
        .filter((el): el is KonvaElement => el !== undefined);

      // 디버그 로그 (단일 선택 시)
      if (elements.length === 1) {
        console.log('[useKonvaSelection] 선택된 요소 데이터:', elements[0]);
      }

      // 캐싱된 요소 Map으로 getSelectionType에 전달 (O(1) 조회)
      const elementMap = new Map(elements.map((el) => [el.id, el]));
      const toolType = getSelectionType(items, (id) => elementMap.get(id));
      if (toolType === null) return;

      // GRAPHIC_EDIT: 스택에 push (뒤로가기 시 SHAPE 패널로 복귀)
      if (toolType === TOGGLE_STATES.GRAPHIC_EDIT) {
        const currentTool = useToolPanelStore.getState().selectedTool;
        // 이미 GRAPHIC_EDIT이면 유지
        if (currentTool === TOGGLE_STATES.GRAPHIC_EDIT) return;

        setSelectedTool(TOGGLE_STATES.SHAPE);
        const { pushMoreView } = useToolPanelStore.getState();
        pushMoreView(TOGGLE_STATES.GRAPHIC_EDIT, '그래픽', [], () => {}, TOGGLE_STATES.SHAPE);
        return;
      }

      // SHAPE 이외 타입: 단순 tool 전환
      if (toolType !== TOGGLE_STATES.SHAPE) {
        setSelectedTool(toolType);
        return;
      }

      // SHAPE 타입: edit view 처리
      const currentTool = useToolPanelStore.getState().selectedTool;
      const isInShapeEditView =
        currentTool === TOGGLE_STATES.SHAPE_EDIT ||
        currentTool === TOGGLE_STATES.LINE_EDIT ||
        currentTool === TOGGLE_STATES.GRAPHIC_EDIT;

      // 이미 edit view면 유지 (타입 전환은 edit 컴포넌트가 처리)
      if (isInShapeEditView) return;

      // 선/도형 구분하여 edit view로 직접 push (캐싱된 elements 재사용)
      const hasLines = elements.some((el) => el.type === 'line' || el.type === 'arrow');

      setSelectedTool(toolType);
      const { pushMoreView } = useToolPanelStore.getState();
      const [editView, editTitle] = hasLines
        ? [TOGGLE_STATES.LINE_EDIT, '선']
        : [TOGGLE_STATES.SHAPE_EDIT, '도형'];
      pushMoreView(editView, editTitle, [], () => {}, TOGGLE_STATES.SHAPE);
    },
    [setSelectedItems, setSelectedTool, resetTextToggleState, getElement],
  );

  /** 단일 요소 선택 헬퍼 */
  const selectElement = useCallback(
    (elementId: string) => {
      const element = getElement(elementId);
      if (!element) return;
      const rootId = (element as { rootId?: string }).rootId || '';
      updateSelection([{ id: elementId, type: element.type, rootId }]);
    },
    [getElement, updateSelection],
  );

  /** 다중 선택 토글 헬퍼 */
  const toggleElementSelection = useCallback(
    (elementId: string) => {
      const element = getElement(elementId);
      if (!element) return;

      const rootId = (element as { rootId?: string }).rootId || '';
      const isSelected = selectedItems.some((item) => item.id === elementId);

      const newItems = isSelected
        ? selectedItems.filter((item) => item.id !== elementId)
        : [...selectedItems, { id: elementId, type: element.type, rootId }];

      updateSelection(newItems);
    },
    [getElement, selectedItems, updateSelection],
  );

  /**
   * 마우스 다운: 드래그 영역 선택 시작
   * - Stage 또는 프레임 배경 클릭 시에만 드래그 선택 시작
   */
  const handleMouseDown = useCallback((e: KonvaEventObject<MouseEvent>) => {
    const target = e.target;
    const stage = target.getStage();

    // Stage 또는 frame-background 클릭 시에만 드래그 선택 시작
    const isEmptyArea = target === stage || target.name() === 'frame-background';
    if (!isEmptyArea) {
      return;
    }

    isSelecting.current = true;
    isDragging.current = false;

    // 메인 레이어 캐싱 (findOne은 비용이 크므로 한 번만 호출)
    const mainLayer = stage?.findOne(`.${MAIN_LAYER_NAME}`) as Konva.Layer | undefined;
    mainLayerRef.current = mainLayer ?? null;

    const pos = mainLayer?.getRelativePointerPosition();
    if (pos) {
      setSelectionRect({
        visible: false,
        x1: pos.x,
        y1: pos.y,
        x2: pos.x,
        y2: pos.y,
      });
    }
  }, []);

  /**
   * 마우스 이동: 드래그 영역 업데이트
   */
  const handleMouseMove = useCallback((e: KonvaEventObject<MouseEvent>) => {
    if (!isSelecting.current) {
      return;
    }

    isDragging.current = true;

    // 캐싱된 레이어 사용 (findOne 호출 제거)
    const pos = mainLayerRef.current?.getRelativePointerPosition();
    if (pos) {
      setSelectionRect((prev) => ({
        visible: true,
        x1: prev.x1,
        y1: prev.y1,
        x2: pos.x,
        y2: pos.y,
      }));
    }
  }, []);

  /**
   * 마우스 업: 드래그 영역 선택 완료
   * - ref 패턴으로 dependency 최소화 (selectionRect, frames 구독 제거)
   */
  const handleMouseUp = useCallback(() => {
    // 캐싱된 레이어 정리
    mainLayerRef.current = null;

    if (!isSelecting.current) {
      return;
    }

    isSelecting.current = false;

    // ref에서 최신 selectionRect 값 사용 (dependency 제거)
    const rect = selectionRectRef.current;
    const selBox = {
      x: Math.min(rect.x1, rect.x2),
      y: Math.min(rect.y1, rect.y2),
      width: Math.abs(rect.x2 - rect.x1),
      height: Math.abs(rect.y2 - rect.y1),
    };

    // 선택 영역 즉시 숨김
    setSelectionRect((prev) => ({
      ...prev,
      visible: false,
    }));

    // 5px 미만 드래그는 단순 클릭으로 간주 → handleStageClick에서 처리
    if (selBox.width < MIN_DRAG_DISTANCE && selBox.height < MIN_DRAG_DISTANCE) {
      isDragging.current = false;
      return;
    }

    // store에서 직접 최신 frames 가져오기 (구독 제거)
    const frames = useCanvasDataStore.getState().frames;
    const currentFrame = frameId ? frames.find((f) => f.id === frameId) : null;
    if (!currentFrame || !isKonvaFrameElement(currentFrame)) return;

    const selected: KonvaElement[] = [];
    currentFrame.children.forEach((el) => {
      if (intersectsWithBox(el, selBox)) {
        selected.push(el);
      }
    });

    updateSelection(
      selected.map((el) => ({
        id: el.id,
        type: el.type,
        rootId: (el as { rootId?: string }).rootId || '',
      })),
    );

    // click 이벤트 처리 후 isDragging 리셋
    setTimeout(() => {
      isDragging.current = false;
    }, 0);
  }, [frameId, updateSelection]);

  /**
   * Stage 클릭: 단일 요소 선택 또는 선택 해제
   *
   * - Stage/Layer/프레임 배경 클릭 시: 선택 해제
   * - 요소 클릭 시: 해당 요소 선택
   * - Shift/Ctrl/Cmd + 클릭: 다중 선택 토글
   * - 그룹 모드: 그룹 내부 요소 개별 선택
   */
  const handleStageClick = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      // 우클릭은 무시 (Context Menu에서 처리)
      if (e.evt.button !== 0) {
        return;
      }

      // 드래그 선택 직후에는 클릭 이벤트 무시
      if (isDragging.current) {
        return;
      }

      const clickedClassName = e.target.getClassName();
      const clickedName = e.target.name();

      // id가 없으면 조상을 따라가며 id 찾기 (Group 내부 요소 지원)
      let clickedId = e.target.id();
      if (!clickedId) {
        const ancestor = e.target.getAncestors().find((node: Konva.Node) => node.id());
        clickedId = ancestor?.id() || '';
      }
      const isFrameBackground = clickedName === 'frame-background';
      const isHoverOverlay = clickedName === '_hover-overlay';
      const isContainerOverlay = clickedName === '_group-overlay' || clickedName === '_frame-overlay';

      // hover 오버레이 클릭 시 ImageControlOverlay에서 이미 처리함
      if (isHoverOverlay) {
        return;
      }

      // 컨테이너 내부 오버레이 클릭 시 현재 선택 유지 (컨테이너 모드 진입 안 함)
      if (isContainerOverlay) {
        return;
      }

      // Stage, Layer, 프레임 배경 클릭 시 선택 초기화 + 그룹 모드 종료
      if (e.target === e.target.getStage() || clickedClassName === 'Layer' || isFrameBackground) {
        if (groupMode.active) {
          exitGroupMode();
        }
        clearSelection();
        resetTextToggleState();
        return;
      }

      // ID가 없는 요소는 선택 초기화
      if (!clickedId) {
        if (groupMode.active) {
          exitGroupMode();
        }
        clearSelection();
        resetTextToggleState();
        return;
      }

      const metaPressed = e.evt.shiftKey || e.evt.ctrlKey || e.evt.metaKey;

      // 컨테이너(Group/Frame) 관련 처리
      const containerParent = findLogicalContainerParent(e.target);
      const isClickOnContainer = isLogicalContainer(e.target);

      // 컨테이너 모드일 때: 내부 요소 선택 (다중 선택 지원)
      if (groupMode.active && groupMode.groupId) {
        const isInsideActiveContainer = isNodeInsideGroup(e.target, groupMode.groupId);
        if (isInsideActiveContainer) {
          metaPressed ? toggleElementSelection(clickedId) : selectElement(clickedId);
          return;
        }
        exitGroupMode();
      }

      // 선택 대상 결정
      let targetId = clickedId;
      if (isClickOnContainer || containerParent) {
        const containerId = isClickOnContainer ? clickedId : containerParent!.id();
        const isContainerSelected = selectedItems.some((item) => item.id === containerId);

        // 컨테이너가 이미 선택된 상태에서 내부 요소 클릭 → 컨테이너 모드 진입 + 내부 요소 선택
        // 내부 요소 드래그는 비활성화됨 (KonvaGroup/KonvaFrame에서 처리)
        if (isContainerSelected && !isClickOnContainer && !metaPressed) {
          enterGroupMode(containerId);
          selectElement(clickedId);
          return;
        }

        // 컨테이너 자체 클릭 또는 미선택 상태 → 컨테이너 선택
        targetId = containerId;
      }

      // 선택 대상 요소 가져오기
      const targetElement = getElement(targetId);
      if (!targetElement) {
        clearSelection();
        resetTextToggleState();
        return;
      }

      const targetRootId = (targetElement as { rootId?: string }).rootId || '';
      const isSelected = selectedItems.some((item) => item.id === targetId);

      // 다중 선택 (Shift/Ctrl/Cmd)
      if (metaPressed) {
        toggleElementSelection(targetId);
        return;
      }

      // 단일 선택
      if (!isSelected) {
        updateSelection([{ id: targetId, type: targetElement.type, rootId: targetRootId }]);
      }
    },
    [clearSelection, resetTextToggleState, getElement, selectedItems, selectElement, toggleElementSelection, updateSelection, enterGroupMode, groupMode, exitGroupMode],
  );

  return {
    selectionRect,
    isDraggingRef: isDragging,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleStageClick,
  };
};

/**
 * useKonvaDrag.ts
 * Konva 요소 드래그 이동 기능
 *
 * ## 책임
 * - 요소 드래그 중 위치 업데이트
 * - 드래그 종료 시 store 업데이트 및 선택 상태 변경
 * - 드래그 중 스냅 가이드라인 표시 및 위치 스냅
 *
 * ## 다중 선택 드래그
 * - 드래그 시작 시 모든 선택된 노드의 시작 위치 저장
 * - 드래그 중 delta 계산 후 모든 선택된 노드 함께 이동
 *
 * ## 사용 예시
 * ```tsx
 * const { handleDragMove, handleDragEnd } = useKonvaDrag();
 *
 * <Rect
 *   draggable
 *   onDragMove={handleDragMove}
 *   onDragEnd={handleDragEnd}
 * />
 * ```
 */

import { useCallback, useRef } from 'react';
import Konva from 'konva';
import { KonvaEventObject } from 'konva/lib/Node';
import { useElementStore } from '@/features/editor/store/useElementStore';
import { useSelectionStore, useSetIsDragging } from '@/features/editor/store/useSelectionStore';
import { useToolPanelStore } from '@/features/editor/store/useToolPanelStore';
import { useSnapStore } from '@/features/editor/store/useSnapStore';
import { recordHistoryIfNeeded } from '@/features/editor/store/useCanvasDataStore';
import { getSelectionType } from '@/features/editor/lib/selection-type';
import { findDropTarget, getFrameScale } from '@/features/editor/utils/dragUtils';
import { findLogicalContainerParent } from '@/features/editor/lib/group-utils';
import {
  getLineGuideStops,
  getObjectSnappingEdges,
  getMultiSelectionSnappingEdges,
  getGuides,
  applySnap,
} from '@/features/editor/utils/snapUtils';
import { getFrameSizeFromLayer } from '@/features/editor/lib/konva-layer-utils';

/**
 * Konva 요소 드래그 이동 기능을 제공하는 훅
 *
 * @returns {Object} 드래그 이벤트 핸들러
 */
export const useKonvaDrag = () => {
  const updateElement = useElementStore((state) => state.updateElement);
  const getElement = useElementStore((state) => state.getElement);
  const moveElementToFrame = useElementStore((state) => state.moveElementToFrame);
  const setSelectedItems = useSelectionStore((state) => state.setSelectedItems);
  const setSelectedTool = useToolPanelStore((state) => state.setSelectedTool);
  const setIsDragging = useSetIsDragging();

  // 스냅 관련
  const setGuides = useSnapStore((state) => state.setGuides);
  const clearGuides = useSnapStore((state) => state.clearGuides);
  const isSnapEnabled = useSnapStore((state) => state.isSnapEnabled);
  const rafRef = useRef<number | null>(null);

  /**
   * 실제 draggable 노드 찾기 (자식 → 부모 탐색)
   */
  const findDraggableNode = (node: Konva.Node): Konva.Node => {
    let current = node;
    while (!current.draggable() && current.getParent()) {
      current = current.getParent() as Konva.Node;
    }
    return current;
  };

  /**
   * 컨테이너 드래그 여부 판별
   * - target이 Group/Frame이고
   * - Transformer에 연결된 노드에 target이 없으면 → 컨테이너 모드에서 빈 공간 드래그
   */
  const isContainerBeingDragged = (target: Konva.Node, transformerNodes: Konva.Node[]): boolean => {
    const targetName = target.name() || '';
    const isTargetContainer =
      targetName.startsWith('data-group') || targetName.startsWith('data-frame');
    const targetNotInTransformerNodes = !transformerNodes.some((n) => n.id() === target.id());
    return isTargetContainer && targetNotInTransformerNodes;
  };

  /**
   * 드래그 시작
   * - 드래그 전 상태를 히스토리에 저장 (undo 지원)
   * - 선택되지 않은 요소 드래그 시 선택 상태로 설정 (Transformer 연결)
   */
  const handleDragStart = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      recordHistoryIfNeeded();
      setIsDragging(true);

      // 드래그하는 요소가 선택되지 않았으면 선택 상태로 설정
      const target = findDraggableNode(e.target);
      const id = target.id();
      const element = getElement(id);

      if (element) {
        const selectedItems = useSelectionStore.getState().selectedItems;
        const isAlreadySelected = selectedItems.some((item) => item.id === id);

        if (!isAlreadySelected) {
          const rootId = (element as { rootId?: string }).rootId || '';
          setSelectedItems([{ id, type: element.type, rootId }]);

          // Tool 연동
          const toolType = getSelectionType([{ id, type: element.type }], getElement);
          if (toolType !== null) {
            setSelectedTool(toolType);
          }
        }
      }
    },
    [setIsDragging, getElement, setSelectedItems, setSelectedTool],
  );

  /**
   * 프레임 정보 가져오기 (DOM 속성에서)
   */
  const getFrameInfo = useCallback((stage: Konva.Stage) => {
    const container = stage.container();
    const frameContainer = container.closest('[data-frame-id]') as HTMLElement | null;

    if (!frameContainer) return null;

    return {
      frameId: frameContainer.dataset.frameId || '',
    };
  }, []);

  /**
   * 드래그 이동 중
   * - Konva 공식 패턴: 드래그 중에는 store 업데이트 안 함
   * - Konva 노드가 자체적으로 위치 관리, Transformer가 자동 추적
   * - 드래그 종료 시 handleDragEnd에서 최종 위치 저장
   * - 스냅 위치 적용은 동기적으로, 가이드라인 렌더링은 RAF로 최적화
   */
  const handleDragMove = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      // 스냅 비활성화 시 스킵
      if (!isSnapEnabled) return;

      const target = findDraggableNode(e.target);

      // 그룹/프레임 안 자식: position()은 부모 상대좌표인데 스냅은 프레임(clip-group) 좌표라
      // 섞이면 글자가 화면 밖으로 날아가 "사라짐"처럼 보인다 → 내부 드래그에선 스냅 생략
      if (findLogicalContainerParent(target)) return;

      const stage = target.getStage();
      const layer = target.getLayer();

      if (!stage || !layer) return;

      // 프레임 정보 가져오기
      const frameInfo = getFrameInfo(stage);
      if (!frameInfo) return;

      // clip-group에서 프레임 크기 가져오기
      const frameSizeResult = getFrameSizeFromLayer(layer, stage);
      if (!frameSizeResult) return;

      const { frameWidth, frameHeight, clipGroup } = frameSizeResult;

      // Transformer에 연결된 노드들 (다중 선택)
      const transformer = stage.findOne('Transformer') as Konva.Transformer | undefined;
      const nodes = transformer?.nodes() || [];
      const transformerNodes = nodes.length > 0 ? nodes : [target];

      const isContainerDrag = isContainerBeingDragged(target, transformerNodes);

      // 스냅 계산에 사용할 노드 결정
      // 컨테이너 드래그 시: target(컨테이너) 사용
      // 일반 드래그 시: transformerNodes 사용
      const snapNodes = isContainerDrag ? [target] : transformerNodes;

      // 스냅 대상 좌표 수집 (자신과 선택된 노드들 제외)
      const lineGuideStops = getLineGuideStops(layer, snapNodes, frameWidth, frameHeight);

      // 현재 객체의 스냅 포인트 계산
      // 단일 선택: snapNodes[0] 사용
      // 다중 선택: 전체 snapNodes의 바운딩 박스 사용
      const itemBounds =
        snapNodes.length > 1
          ? getMultiSelectionSnappingEdges(snapNodes, clipGroup, target)
          : getObjectSnappingEdges(snapNodes[0], clipGroup);

      // 스냅 가이드라인 찾기
      const guides = getGuides(lineGuideStops, itemBounds);

      if (guides.length > 0) {
        // 위치 스냅 적용 (동기적으로 즉시 처리 → 흔들림 방지)
        const currentPos = target.position();
        const snappedPos = applySnap(currentPos, guides);
        const deltaX = snappedPos.x - currentPos.x;
        const deltaY = snappedPos.y - currentPos.y;

        // 스냅 위치 적용
        // - target이 transformerNodes에 포함되어 있으면: 정상적인 다중 선택 드래그 → 모든 노드에 적용
        // - target이 포함되지 않았으면: transformerNodes가 stale 상태 → target에만 적용
        const isTargetInTransformer = transformerNodes.some((node) => node.id() === target.id());
        const nodesToSnap = isTargetInTransformer ? transformerNodes : [target];

        nodesToSnap.forEach((node) => {
          const nodePos = node.position();
          node.position({
            x: nodePos.x + deltaX,
            y: nodePos.y + deltaY,
          });
        });

        // 가이드라인 렌더링은 RAF로 최적화 (시각적 업데이트)
        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current);
        }
        rafRef.current = requestAnimationFrame(() => {
          setGuides(guides, frameInfo.frameId);
          rafRef.current = null;
        });
      } else {
        // 스냅 범위 밖이면 가이드라인 제거
        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current);
        }
        rafRef.current = requestAnimationFrame(() => {
          clearGuides();
          rafRef.current = null;
        });
      }
    },
    [isSnapEnabled, getFrameInfo, setGuides, clearGuides],
  );

  /**
   * 드래그 종료
   *
   * - 다른 프레임에 드롭 시 프레임 간 이동
   * - 요소 위치 store 업데이트 (다중 선택 시 Transformer에 연결된 모든 노드)
   * - 드래그한 요소를 선택 상태로 설정
   * - 스냅 가이드라인 정리
   */
  const handleDragEnd = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      // RAF 정리
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }

      // 가이드라인 정리
      clearGuides();

      // 드래그 종료 시 SelectionOverlay 다시 표시
      setIsDragging(false);

      // 실제 draggable 노드 찾기
      const target = findDraggableNode(e.target);

      const id = target.id();
      const element = getElement(id);

      // 요소가 존재하지 않으면 무시 (삭제된 요소 드래그 등 엣지케이스)
      if (!element) return;

      const rootId = (element as { rootId?: string }).rootId || '';

      // Transformer에 연결된 모든 노드 가져오기 (다중 선택 지원)
      const transformer = target.getStage()?.findOne('Transformer') as
        | Konva.Transformer
        | undefined;
      const nodes = transformer?.nodes();
      const transformerNodes = nodes && nodes.length > 0 ? nodes : [target];

      // 컨테이너 드래그 여부 (내부 요소 선택 상태에서 컨테이너 빈 공간 드래그)
      const isContainerDrag = isContainerBeingDragged(target, transformerNodes);

      // native event가 없으면 같은 프레임 내 이동만 처리
      const nativeEvent = e.evt;
      if (!nativeEvent) {
        const nodesToUpdate = isContainerDrag ? [target] : transformerNodes;
        nodesToUpdate.forEach((node) => {
          updateElement(node.id(), { x: node.x(), y: node.y() });
        });
        return;
      }

      // 드롭 대상 프레임 확인
      const dropTarget = findDropTarget(nativeEvent.clientX, nativeEvent.clientY);
      const currentFrameId = rootId;

      // 다른 프레임에 드롭한 경우 이동
      if (dropTarget && currentFrameId && dropTarget.frameId !== currentFrameId) {
        const stage = target.getStage();
        const stageBox = stage?.container().getBoundingClientRect();

        // destination 프레임 스케일 (source는 getAbsolutePosition()에 이미 적용됨)
        const targetScale = getFrameScale(dropTarget.frameId);

        // destination 프레임 컨테이너의 raw rect (layerOffset 없는 좌표 계산용)
        const destContainer = document.querySelector(
          `[data-frame-id="${dropTarget.frameId}"]`,
        ) as HTMLElement;
        const destRect = destContainer?.getBoundingClientRect();

        // 컨테이너 드래그: 컨테이너만 이동
        if (isContainerDrag) {
          // getAbsolutePosition()은 Layer의 scale/offset이 이미 적용된 Stage 기준 좌표 반환
          // 따라서 sourceScale을 다시 곱하면 안 됨 (이중 스케일 방지)
          const targetPosition = target.getAbsolutePosition();
          const elementScreenX = (stageBox?.left ?? 0) + targetPosition.x;
          const elementScreenY = (stageBox?.top ?? 0) + targetPosition.y;
          const screenOffsetX = elementScreenX - nativeEvent.clientX;
          const screenOffsetY = elementScreenY - nativeEvent.clientY;

          // raw 마우스 좌표 (layerOffset 없이)
          const rawMouseX = (nativeEvent.clientX - (destRect?.left ?? 0)) / targetScale;
          const rawMouseY = (nativeEvent.clientY - (destRect?.top ?? 0)) / targetScale;
          const targetNewX = rawMouseX + screenOffsetX / targetScale;
          const targetNewY = rawMouseY + screenOffsetY / targetScale;

          moveElementToFrame(target.id(), dropTarget.frameId, { x: targetNewX, y: targetNewY });
          setSelectedItems([{ id: target.id(), type: element.type, rootId: dropTarget.frameId }]);
          const toolType = getSelectionType([{ id: target.id(), type: element.type }], getElement);
          if (toolType !== null) {
            setSelectedTool(toolType);
          }
          return;
        }

        // 일반/다중 선택: 각 노드의 screen offset을 개별 계산
        // (그룹과 달리 각 요소가 독립적이므로 각각의 마우스 offset 필요)
        const movedItems: { id: string; type: string; rootId: string }[] = [];

        // destination 좌표 계산을 위한 공통 값
        const rawMouseX = (nativeEvent.clientX - (destRect?.left ?? 0)) / targetScale;
        const rawMouseY = (nativeEvent.clientY - (destRect?.top ?? 0)) / targetScale;

        transformerNodes.forEach((node) => {
          const nodeElement = getElement(node.id());
          if (!nodeElement) return;

          // 각 노드의 screen 위치 계산 (source 기준)
          // getAbsolutePosition()은 Layer의 scale/offset이 이미 적용된 Stage 기준 좌표 반환
          const nodeAbsPos = node.getAbsolutePosition();
          const nodeScreenX = (stageBox?.left ?? 0) + nodeAbsPos.x;
          const nodeScreenY = (stageBox?.top ?? 0) + nodeAbsPos.y;

          // 마우스로부터의 screen offset
          const nodeScreenOffsetX = nodeScreenX - nativeEvent.clientX;
          const nodeScreenOffsetY = nodeScreenY - nativeEvent.clientY;

          // destination 좌표 = raw mouse 위치 + screen offset (destination scale 적용)
          const newX = rawMouseX + nodeScreenOffsetX / targetScale;
          const newY = rawMouseY + nodeScreenOffsetY / targetScale;

          moveElementToFrame(node.id(), dropTarget.frameId, { x: newX, y: newY });

          movedItems.push({
            id: node.id(),
            type: nodeElement.type,
            rootId: dropTarget.frameId,
          });
        });

        setSelectedItems(movedItems);
        const toolType = getSelectionType(movedItems, getElement);
        if (toolType !== null) {
          setSelectedTool(toolType);
        }
        return;
      }

      // 같은 프레임 내 이동
      const nodesToUpdate = isContainerDrag ? [target] : transformerNodes;
      nodesToUpdate.forEach((node) => {
        updateElement(node.id(), { x: node.x(), y: node.y() });
      });
    },
    [
      getElement,
      updateElement,
      moveElementToFrame,
      setSelectedItems,
      setSelectedTool,
      setIsDragging,
      clearGuides,
    ],
  );

  return {
    handleDragStart,
    handleDragMove,
    handleDragEnd,
  };
};

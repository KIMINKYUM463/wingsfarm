/**
 * useContextMenu.ts
 * Konva 캔버스의 Context Menu 상태 관리
 *
 * ## 기능
 * - 우클릭 시 Context Menu 표시
 * - 우클릭 시 해당 요소 선택 (그룹 처리 포함)
 * - frame-background 제외 (요소만 메뉴 표시)
 */

import { useState, useCallback } from 'react';
import { KonvaEventObject, Node, NodeConfig } from 'konva/lib/Node';
import { useSelectionStore } from '@/features/editor/store/useSelectionStore';
import { useElementStore } from '@/features/editor/store/useElementStore';
import { useToolPanelStore } from '@/features/editor/store/useToolPanelStore';
import { getSelectionType } from '@/features/editor/lib/selection-type';
import { isLogicalGroup, findLogicalGroupParent } from '@/features/editor/lib/group-utils';

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  targetId: string | null;
}

const INITIAL_STATE: ContextMenuState = {
  visible: false,
  x: 0,
  y: 0,
  targetId: null,
};

/** Container 인터페이스 (Group, Layer 등 자식을 가질 수 있는 노드) */
interface ContainerNode extends Node<NodeConfig> {
  getChildren(): Node<NodeConfig>[];
}

/** Container 타입 가드 */
const isContainer = (node: Node): node is ContainerNode => {
  return typeof (node as ContainerNode).getChildren === 'function';
};

/**
 * 서브트리에서 id가 있는 첫 번째 노드 찾기 (재귀)
 */
const findIdInSubtree = (node: Node): string => {
  const nodeId = node.id?.();
  if (nodeId) return nodeId;

  if (isContainer(node)) {
    for (const child of node.getChildren()) {
      const childId = findIdInSubtree(child);
      if (childId) return childId;
    }
  }

  return '';
};

/**
 * 타겟 노드 또는 조상에서 id 찾기
 * - Group > Text 등 중첩 구조에서 부모의 id를 찾을 때 사용
 * - _hover-overlay 클릭 시 실제 요소 id 찾기 지원
 */
const findElementId = (target: Node, stopNode: Node): string => {
  const targetName = target.name?.() || '';

  // 자신의 id 먼저 확인
  const selfId = target.id();
  if (selfId) return selfId;

  // _hover-overlay 클릭: 실제 요소의 id 찾기
  // 구조: target(_hover-overlay Rect) → overlay Group → wrapper Group → [children(실제 요소), overlay Group]
  if (targetName === '_hover-overlay') {
    const overlayGroup = target.parent;
    const wrapperGroup = overlayGroup?.parent;

    if (wrapperGroup && isContainer(wrapperGroup)) {
      for (const sibling of wrapperGroup.getChildren()) {
        if (sibling === overlayGroup) continue;
        const foundId = findIdInSubtree(sibling);
        if (foundId) return foundId;
      }
    }
  }

  // 조상 중 id가 있는 첫 번째 노드 찾기
  const ancestors = target.getAncestors();
  const ancestorWithId = ancestors.find((node: Node) => node.id() && node !== stopNode);

  return ancestorWithId?.id() ?? '';
};

export const useContextMenu = () => {
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(INITIAL_STATE);

  // Stores
  const setSelectedItems = useSelectionStore((s) => s.setSelectedItems);
  const getElement = useElementStore((s) => s.getElement);
  const setSelectedTool = useToolPanelStore((s) => s.setSelectedTool);

  const handleContextMenu = useCallback(
    (e: KonvaEventObject<PointerEvent>) => {
      e.evt.preventDefault();

      const stage = e.target.getStage();
      if (!stage) return;

      // Stage 자체 클릭 시 메뉴 표시 안 함
      if (e.target === stage) return;

      // 화면 절대 좌표 사용 (Portal로 body에 렌더링되므로)
      const clientX = e.evt.clientX;
      const clientY = e.evt.clientY;

      // 요소 ID 찾기
      let elementId = findElementId(e.target, stage);
      if (!elementId) return;

      // 그룹 처리: 그룹 내부 요소 클릭 시 그룹을 선택
      const groupParent = findLogicalGroupParent(e.target);
      const isClickOnGroup = isLogicalGroup(e.target);

      if (isClickOnGroup || groupParent) {
        const groupId = isClickOnGroup ? elementId : groupParent!.id();
        elementId = groupId;
      }

      // 요소 정보 가져오기
      const element = getElement(elementId);
      if (!element) return;

      const rootId = (element as { rootId?: string }).rootId || '';

      // 요소 선택
      const selectedItem = { id: elementId, type: element.type, rootId };
      setSelectedItems([selectedItem]);

      // Tool Panel 연동
      const toolType = getSelectionType([selectedItem], getElement);
      if (toolType !== null) {
        setSelectedTool(toolType);
      }

      // Context Menu 표시
      setContextMenu({
        visible: true,
        x: clientX,
        y: clientY,
        targetId: elementId,
      });
    },
    [getElement, setSelectedItems, setSelectedTool],
  );

  const closeContextMenu = useCallback(() => {
    setContextMenu(INITIAL_STATE);
  }, []);

  /**
   * 프로그래매틱하게 Context Menu 열기
   * - 툴박스 "..." 버튼 등에서 사용
   */
  const openContextMenu = useCallback(
    (x: number, y: number, targetId: string) => {
      setContextMenu({
        visible: true,
        x,
        y,
        targetId,
      });
    },
    [],
  );

  return { contextMenu, handleContextMenu, closeContextMenu, openContextMenu };
};

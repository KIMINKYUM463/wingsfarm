/**
 * useSelectionStore.ts
 * 캔버스 요소 선택 상태 관리
 *
 * ## 책임
 * - 선택된 요소 ID/타입 관리
 * - 선택/해제 액션
 *
 * ## 사용처
 * - KonvaFrame (요소 선택)
 * - SelectionToolbox (선택된 요소 정보)
 * - EditorTransformer (Transformer 노드)
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import type Konva from 'konva';
import { useCanvasDataStore } from './useCanvasDataStore';

export interface SelectedItem {
  id: string;
  type: string;
  rootId: string; // 요소가 속한 프레임 ID
}

interface GroupMode {
  active: boolean;
  groupId: string | null;
}

interface SelectionState {
  selectedItems: SelectedItem[];
  isDragging: boolean;
  groupMode: GroupMode;
  isMultiSelectionRotating: boolean;
  rotatingBoxNode: Konva.Rect | null;
  setSelectedItems: (items: SelectedItem[]) => void;
  setIsDragging: (isDragging: boolean) => void;
  clearSelection: () => void;
  enterGroupMode: (groupId: string) => void;
  exitGroupMode: () => void;
  setMultiSelectionRotating: (isRotating: boolean) => void;
  setRotatingBoxNode: (node: Konva.Rect | null) => void;
}

export const useSelectionStore = create<SelectionState>()(
  devtools(
    (set) => ({
      selectedItems: [],
      isDragging: false,
      groupMode: { active: false, groupId: null },
      isMultiSelectionRotating: false,
      rotatingBoxNode: null,

      setSelectedItems: (items: SelectedItem[]) => {
        set({ selectedItems: items });
        if (items.length > 0) {
          const flatElements = useCanvasDataStore.getState().flatElements;
          const elements = items.map((item) => flatElements.get(item.id));
        }
      },

      setIsDragging: (isDragging: boolean) => {
        set({ isDragging });
      },

      clearSelection: () => {
        set({ selectedItems: [], groupMode: { active: false, groupId: null } });
      },

      enterGroupMode: (groupId: string) => {
        set({ groupMode: { active: true, groupId } });
      },

      exitGroupMode: () => {
        set({ groupMode: { active: false, groupId: null } });
      },

      setMultiSelectionRotating: (isRotating: boolean) => {
        set({ isMultiSelectionRotating: isRotating });
      },

      setRotatingBoxNode: (node: Konva.Rect | null) => {
        set({ rotatingBoxNode: node });
      },
    }),
    { name: 'selection-store' },
  ),
);

// 셀렉터 함수들
export const useSelectedItems = () => useSelectionStore((state) => state.selectedItems);

export const useSelectedIds = () =>
  useSelectionStore(useShallow((state) => state.selectedItems.map((item) => item.id)));

export const useIsSelected = () => useSelectionStore((state) => state.selectedItems.length > 0);

export const useIsElementSelected = (elementId: string) =>
  useSelectionStore((state) => state.selectedItems.some((item) => item.id === elementId));

export const useClearSelection = () => useSelectionStore((state) => state.clearSelection);

export const useSetSelectedItems = () => useSelectionStore((state) => state.setSelectedItems);

export const useIsDragging = () => useSelectionStore((state) => state.isDragging);

export const useSetIsDragging = () => useSelectionStore((state) => state.setIsDragging);

// 그룹 모드 셀렉터
export const useGroupMode = () => useSelectionStore((state) => state.groupMode);

export const useEnterGroupMode = () => useSelectionStore((state) => state.enterGroupMode);

export const useExitGroupMode = () => useSelectionStore((state) => state.exitGroupMode);

// 다중 선택 회전 셀렉터
export const useIsMultiSelectionRotating = () =>
  useSelectionStore((state) => state.isMultiSelectionRotating);

export const useSetMultiSelectionRotating = () =>
  useSelectionStore((state) => state.setMultiSelectionRotating);

export const useSetRotatingBoxNode = () =>
  useSelectionStore((state) => state.setRotatingBoxNode);

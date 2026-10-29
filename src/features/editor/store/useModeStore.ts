import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface ModeState {
  selectedElementId: string | null;
  hoveredElementId: string | null;
  editingElementId: string | null;

  // 액션 함수들
  selectElement: (elementId: string) => void;
  unselectElement: () => void;
  setHover: (elementId: string | null) => void;
  startEdit: (elementId: string) => void;
  stopEdit: () => void;
}

export const useModeStore = create<ModeState>()(
  devtools(
    (set) => ({
      selectedElementId: null,
      hoveredElementId: null,
      editingElementId: null,

      selectElement: (elementId: string) => {
        set({ selectedElementId: elementId });
      },
      unselectElement: () => set({ selectedElementId: null }),
      setHover: (elementId: string | null) => set({ hoveredElementId: elementId }),
      startEdit: (elementId: string) => set({ editingElementId: elementId }),
      stopEdit: () => set({ editingElementId: null }),
    }),
    { name: 'editor-mode-store' },
  ),
);

// 특정 요소가 선택되었는지 여부
export const useIsSelected = (elementId: string) =>
  useModeStore((state) => state.selectedElementId === elementId);

// 특정 요소가 호버되었는지 여부
export const useIsHovered = (elementId: string) =>
  useModeStore((state) => state.hoveredElementId === elementId);

// 특정 요소가 편집 중인지 여부
export const useIsEditing = (elementId: string) =>
  useModeStore((state) => state.editingElementId === elementId);

// 호환성을 위한 별칭
export const useIsActive = useIsHovered;
export const useIsEdit = useIsEditing;

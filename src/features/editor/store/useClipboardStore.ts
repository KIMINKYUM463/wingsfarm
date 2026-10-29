/**
 * useClipboardStore.ts
 * 에디터 내 복사/붙여넣기를 위한 클립보드 상태 관리
 */

import { create } from 'zustand';
import { KonvaElement } from '@/shared/types/konva';

const PASTE_OFFSET = 20;

interface ClipboardState {
  /** 복사된 요소들 (깊은 복사본) */
  copiedElements: KonvaElement[];
  /** 복사 원본의 프레임 ID */
  sourceFrameId: string | null;
  /** 붙여넣기 횟수 (오프셋 계산용) */
  pasteCount: number;
}

interface ClipboardActions {
  /** 요소 복사 (붙여넣기 횟수 초기화) */
  copy: (elements: KonvaElement[], frameId: string) => void;
  /** 붙여넣기 오프셋 반환 및 횟수 증가 */
  getNextPasteOffset: () => number;
  /** 클립보드 초기화 */
  clear: () => void;
}

type ClipboardStore = ClipboardState & ClipboardActions;

export const useClipboardStore = create<ClipboardStore>((set, get) => ({
  copiedElements: [],
  sourceFrameId: null,
  pasteCount: 0,

  copy: (elements, frameId) => {
    const deepCopied = JSON.parse(JSON.stringify(elements));
    set({ copiedElements: deepCopied, sourceFrameId: frameId, pasteCount: 0 });
  },

  getNextPasteOffset: () => {
    const currentCount = get().pasteCount;
    set({ pasteCount: currentCount + 1 });
    return (currentCount + 1) * PASTE_OFFSET;
  },

  clear: () => {
    set({ copiedElements: [], sourceFrameId: null, pasteCount: 0 });
  },
}));

// 선택자
export const useCopiedElements = () => useClipboardStore((s) => s.copiedElements);
export const useHasClipboardContent = () => useClipboardStore((s) => s.copiedElements.length > 0);

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { KonvaFrameElement } from '@/shared/types/konva';

/**
 * 히스토리 저장소 (스냅샷 기반 Undo/Redo)
 *
 * ## 구현 방식
 * - Konva 공식 권장: 전체 상태 스냅샷 저장
 * - frames 배열만 저장 (flatElements는 frames에서 재생성)
 *
 * ## 최적화
 * - 히스토리 개수 제한 (MAX_HISTORY_SIZE)
 * - 구조적 공유: 변경되지 않은 프레임은 참조 유지
 */

const MAX_HISTORY_SIZE = 50;

interface HistoryState {
  // 히스토리 스냅샷 배열
  history: KonvaFrameElement[][];
  // 현재 히스토리 위치 (0-indexed)
  historyStep: number;

  // 초기 상태 저장 (에디터 로드 시 호출)
  initHistory: (frames: KonvaFrameElement[]) => void;
  // 새 스냅샷 저장
  pushHistory: (frames: KonvaFrameElement[]) => void;
  // 현재 스냅샷 업데이트 (변경 완료 후 최종 상태 반영)
  updateCurrentSnapshot: (frames: KonvaFrameElement[]) => void;
  // Undo - 이전 상태 반환
  undo: () => KonvaFrameElement[] | null;
  // Redo - 다음 상태 반환
  redo: () => KonvaFrameElement[] | null;
  // 히스토리 초기화
  clearHistory: () => void;
  // 상태 체크
  canUndo: () => boolean;
  canRedo: () => boolean;
}

export const useHistoryStore = create<HistoryState>()(
  devtools(
    (set, get) => ({
      history: [],
      historyStep: -1,

      initHistory: (frames: KonvaFrameElement[]) => {
        set({
          history: [structuredClone(frames)],
          historyStep: 0,
        });
      },

      pushHistory: (frames: KonvaFrameElement[]) => {
        const { history, historyStep } = get();

        // 현재 위치 이후의 히스토리 제거 (redo 스택 클리어)
        const newHistory = history.slice(0, historyStep + 1);

        // 새 스냅샷 추가 (깊은 복사로 참조 공유 방지)
        newHistory.push(structuredClone(frames));

        // 최대 크기 제한
        if (newHistory.length > MAX_HISTORY_SIZE) {
          newHistory.shift();
        }

        set({
          history: newHistory,
          historyStep: newHistory.length - 1,
        });
      },

      updateCurrentSnapshot: (frames: KonvaFrameElement[]) => {
        const { history, historyStep } = get();
        if (historyStep < 0 || historyStep >= history.length) return;

        // 현재 스냅샷을 최종 상태로 업데이트
        const newHistory = [...history];
        newHistory[historyStep] = structuredClone(frames);
        set({ history: newHistory });
      },

      undo: () => {
        const { history, historyStep } = get();

        if (historyStep <= 0) return null;

        const newStep = historyStep - 1;
        set({ historyStep: newStep });

        return history[newStep];
      },

      redo: () => {
        const { history, historyStep } = get();

        if (historyStep >= history.length - 1) return null;

        const newStep = historyStep + 1;
        set({ historyStep: newStep });

        return history[newStep];
      },

      clearHistory: () => {
        set({
          history: [],
          historyStep: -1,
        });
      },

      canUndo: () => {
        return get().historyStep > 0;
      },

      canRedo: () => {
        const { history, historyStep } = get();
        return historyStep < history.length - 1;
      },
    }),
    { name: 'history-store' },
  ),
);

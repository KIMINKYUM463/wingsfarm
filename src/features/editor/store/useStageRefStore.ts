import { create } from 'zustand';
import type Konva from 'konva';

/**
 * Stage ref 저장소
 * 각 프레임의 Stage 인스턴스를 저장하여 다운로드 등에서 사용
 */
interface StageRefState {
  stageRefs: Map<string, Konva.Stage>;
  registerStage: (frameId: string, stage: Konva.Stage) => void;
  unregisterStage: (frameId: string) => void;
  getStage: (frameId: string) => Konva.Stage | undefined;
  getAllStages: () => Konva.Stage[];
  clear: () => void;
}

export const useStageRefStore = create<StageRefState>((set, get) => ({
  stageRefs: new Map(),

  registerStage: (frameId: string, stage: Konva.Stage) => {
    set((state) => {
      const newRefs = new Map(state.stageRefs);
      newRefs.set(frameId, stage);
      return { stageRefs: newRefs };
    });
  },

  unregisterStage: (frameId: string) => {
    set((state) => {
      const newRefs = new Map(state.stageRefs);
      newRefs.delete(frameId);
      return { stageRefs: newRefs };
    });
  },

  getStage: (frameId: string) => {
    return get().stageRefs.get(frameId);
  },

  getAllStages: () => {
    return Array.from(get().stageRefs.values());
  },

  clear: () => {
    set({ stageRefs: new Map() });
  },
}));

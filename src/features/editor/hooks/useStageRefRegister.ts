import { useEffect } from 'react';
import type { Stage } from 'react-konva';
import { useStageRefStore } from '@/features/editor/store/useStageRefStore';

/**
 * Stage ref를 전역 store에 등록/해제하는 훅
 *
 * ## 목적
 * - 프레임 외부에서 Stage에 접근해야 할 때 사용 (예: 이미지 다운로드, 전체 캔버스 export)
 * - 여러 Frame이 있을 때, frameId를 키로 해당 Stage를 찾을 수 있음
 *
 * ## 동작
 * - 마운트 시: Stage ref를 store에 등록
 * - 언마운트 시: store에서 제거 (메모리 누수 방지)
 *
 * @param frameId - 프레임 고유 ID
 * @param stageRef - react-konva Stage ref
 */
export const useStageRefRegister = (
  frameId: string,
  stageRef: React.RefObject<React.ComponentRef<typeof Stage> | null>,
) => {
  const registerStage = useStageRefStore((state) => state.registerStage);
  const unregisterStage = useStageRefStore((state) => state.unregisterStage);

  useEffect(() => {
    // react-konva의 Stage ref는 getStage()로 실제 Konva.Stage 인스턴스를 얻을 수 있음
    const stage = stageRef.current?.getStage();
    if (stage) {
      registerStage(frameId, stage);
    }
    return () => {
      unregisterStage(frameId);
    };
  }, [frameId, stageRef, registerStage, unregisterStage]);
};

/**
 * Stage 캡처 관련 유틸리티
 */
import type Konva from 'konva';

/**
 * UI 요소를 숨긴 상태에서 콜백 실행 후 복원
 *
 * 호버 오버레이, 선택 UI 등을 숨기고 캡처 후 복원합니다.
 *
 * @param stage - Konva Stage
 * @param fn - UI 숨김 상태에서 실행할 콜백
 * @returns 콜백 실행 결과
 */
export const withHiddenUI = async <T>(stage: Konva.Stage, fn: () => Promise<T>): Promise<T> => {
  // UI 요소 찾기
  const hoverOverlays = stage.find('._hover-overlay');
  const selectionUIs = stage.find('._selection-ui');
  const allUIElements = [...hoverOverlays, ...selectionUIs];

  // 원래 상태 저장
  const originalVisibility = allUIElements.map((node) => node.visible());

  // UI 숨기기
  allUIElements.forEach((node) => node.visible(false));
  stage.draw();

  try {
    return await fn();
  } finally {
    // UI 복원
    allUIElements.forEach((node, index) => {
      node.visible(originalVisibility[index]);
    });
    stage.draw();
  }
};

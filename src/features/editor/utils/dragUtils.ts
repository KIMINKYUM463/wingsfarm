/**
 * dragUtils.ts
 * 드래그 관련 공유 유틸리티
 */

export interface DropTarget {
  frameId: string;
  localX: number;
  localY: number;
}

/**
 * 마우스 위치에서 드롭 대상 프레임과 로컬 좌표를 찾음
 * data-frame-id, data-layer-offset-x/y, data-scale 속성 활용
 */
export const findDropTarget = (clientX: number, clientY: number): DropTarget | null => {
  const elements = document.elementsFromPoint(clientX, clientY);
  for (const el of elements) {
    const htmlEl = el as HTMLElement;
    const frameId = htmlEl.dataset?.frameId;
    if (!frameId) continue;

    const layerOffsetX = parseFloat(htmlEl.dataset.layerOffsetX || '0');
    const layerOffsetY = parseFloat(htmlEl.dataset.layerOffsetY || '0');
    const scale = parseFloat(htmlEl.dataset.scale || '1') || 1; // 0 방지

    const rect = htmlEl.getBoundingClientRect();
    const mouseX = clientX - rect.left;
    const mouseY = clientY - rect.top;
    const localX = (mouseX - layerOffsetX) / scale;
    const localY = (mouseY - layerOffsetY) / scale;

    return { frameId, localX, localY };
  }
  return null;
};

/**
 * 대상 프레임의 scale 값을 가져옴
 */
export const getFrameScale = (frameId: string): number => {
  const container = document.querySelector(`[data-frame-id="${frameId}"]`) as HTMLElement;
  return parseFloat(container?.dataset?.scale || '1') || 1; // 0 방지
};

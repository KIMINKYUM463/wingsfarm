import Konva from 'konva';

/**
 * clip-group에서 프레임 크기를 가져온 결과
 */
export interface FrameSizeResult {
  frameWidth: number;
  frameHeight: number;
  clipGroup: Konva.Group;
}

/**
 * Layer의 clip-group에서 프레임 크기를 가져옴
 *
 * ## 사용처
 * - useKonvaDrag: 드래그 중 스냅 계산
 * - useKonvaTransform: 변형 중 스냅 계산
 *
 * @param layer - Konva Layer
 * @param stage - Konva Stage (fallback 크기용)
 * @returns FrameSizeResult | null (clip-group이 없으면 null)
 */
export const getFrameSizeFromLayer = (
  layer: Konva.Layer,
  stage: Konva.Stage,
): FrameSizeResult | null => {
  const clipGroup = layer.findOne('.clip-group') as Konva.Group | undefined;
  if (!clipGroup) return null;

  const clip = clipGroup.getAttr('clip') as
    | { x: number; y: number; width: number; height: number }
    | undefined;

  return {
    frameWidth: clip?.width || stage.width(),
    frameHeight: clip?.height || stage.height(),
    clipGroup,
  };
};

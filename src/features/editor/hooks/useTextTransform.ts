import { useCallback } from 'react';
import Konva from 'konva';

// 최소 크기 상수 (transformerUtils와 동일)
const MIN_WIDTH = 20;
const MIN_FONT_SIZE = 8;

/**
 * 텍스트 Transform 중 실시간 프리뷰를 위한 훅
 * - onTransform 이벤트에서 사용 (드래그 중 매 프레임 호출)
 * - scale을 width/fontSize로 변환하여 실시간 반영
 * - 최소값 이하로 줄어들면 최소값으로 clamp
 * - height는 자동 계산되도록 undefined 설정
 *
 * 주의: Text는 Group으로 감싸져 있고, Transformer는 Group에 적용됨
 * 따라서 Group의 scale을 읽어서 Text에 적용해야 함
 */
export const useTextTransform = (konvaTextRef: React.RefObject<Konva.Text | null>) => {
  const handleTransform = useCallback(() => {
    const textNode = konvaTextRef.current;
    if (!textNode) return;

    // Text의 부모 Group에서 scale 가져오기 (Transformer가 Group에 적용됨)
    const group = textNode.getParent();
    if (!group) return;

    const scaleX = group.scaleX();
    const scaleY = group.scaleY();

    // scale이 이미 1이면 스킵 (리셋 후 불필요한 재적용 방지)
    // 이 체크가 없으면 좌우 변 리사이즈 시 매 프레임 scale이 재적용되어 무한 축소됨
    if (Math.abs(scaleX - 1) < 0.001 && Math.abs(scaleY - 1) < 0.001) return;

    // 현재 크기
    const currentWidth = textNode.width();
    const currentFontSize = textNode.fontSize();

    // 좌우 변 리사이즈 체크 (scaleY가 1에 가까우면 수평 리사이즈)
    const isHorizontalResize = Math.abs(scaleY - 1) < 0.001;
    const isAtMinWidth = currentWidth <= MIN_WIDTH;
    const isShrinking = scaleX < 1;

    // Group scale 리셋
    group.setAttrs({
      scaleX: 1,
      scaleY: 1,
    });

    // 좌우 리사이즈 시 이미 최소 너비이고 축소 시도면 크기 변경 없음
    if (isHorizontalResize && isAtMinWidth && isShrinking) {
      return;
    }

    // 새 크기 계산 (최소값으로 clamp)
    const newWidth = Math.max(currentWidth * scaleX, MIN_WIDTH);
    const newFontSize = Math.max(currentFontSize * scaleY, MIN_FONT_SIZE);

    textNode.setAttrs({
      width: newWidth,
      fontSize: newFontSize,
      height: undefined, // 자동 높이 계산
    });

    // hover 테두리용 형제 Rect도 크기 동기화
    const children = group.getChildren();
    const textIndex = children.indexOf(textNode);
    const rectNode = children[textIndex - 1];
    if (rectNode && rectNode.getClassName() === 'Rect') {
      rectNode.setAttrs({
        width: newWidth,
        height: textNode.height(), // Text의 자동 계산된 높이 사용
      });
    }
  }, [konvaTextRef]);

  return {
    handleTransform,
  };
};

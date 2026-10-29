import type { KonvaElement, KonvaFrameElement } from '@/shared/types/konva';
import { isKonvaGroupElement, isKonvaFrameElement } from '@/shared/types/konva';

/**
 * rootId로 특정 프레임의 children만 변환 (다른 프레임은 참조 유지)
 *
 * ## 사용처
 * - deleteElement: 요소 삭제 시 해당 프레임만 업데이트
 * - duplicateElement: 요소 복제 시 해당 프레임만 업데이트
 * - updateElement: 요소 수정 시 해당 프레임만 업데이트
 *
 * ## 성능
 * O(frames.length) - 전체 트리 순회 대신 프레임만 순회
 *
 * @param frames - 전체 프레임 배열
 * @param rootId - 대상 프레임의 ID (자식 요소의 rootId)
 * @param transformFn - children을 변환하는 함수
 * @returns 변환된 새 프레임 배열 (Structural Sharing)
 */
export const updateFrameChildren = (
  frames: KonvaFrameElement[],
  rootId: string,
  transformFn: (children: KonvaElement[]) => KonvaElement[],
): KonvaFrameElement[] => {
  return frames.map((frame) => {
    if (frame.id !== rootId) return frame; // 참조 유지
    const newChildren = transformFn(frame.children);
    // children이 변경되지 않았으면 프레임도 참조 유지
    if (newChildren === frame.children) return frame;
    return { ...frame, children: newChildren };
  });
};

/**
 * children 배열 내에서 특정 요소 업데이트 (재귀, Structural Sharing)
 *
 * ## 동작
 * - 1depth children에서 elementId 찾기
 * - Group 내부도 재귀적으로 탐색
 * - 변경 없으면 기존 배열 참조 유지
 *
 * @param children - 탐색할 children 배열
 * @param elementId - 업데이트할 요소 ID
 * @param updatedElement - 새 요소
 * @returns 업데이트된 children 배열 (변경 없으면 기존 참조)
 */
export const updateElementInChildren = (
  children: KonvaElement[],
  elementId: string,
  updatedElement: KonvaElement,
): KonvaElement[] => {
  let hasChanges = false;

  const newChildren = children.map((element) => {
    // 대상 요소 발견
    if (element.id === elementId) {
      hasChanges = true;
      return updatedElement;
    }

    // Group과 Frame 내부 재귀 탐색 (Frame 안에 Frame 중첩 가능)
    if (isKonvaGroupElement(element) || isKonvaFrameElement(element)) {
      const updatedGroupChildren = updateElementInChildren(
        element.children,
        elementId,
        updatedElement,
      );
      // 자식이 실제로 변경된 경우에만 새 객체 생성
      if (updatedGroupChildren !== element.children) {
        hasChanges = true;
        return { ...element, children: updatedGroupChildren } as KonvaElement;
      }
    }

    return element; // 변경 없으면 기존 참조 유지
  });

  // 배열 내용이 실제로 변경되었을 때만 새 배열 반환
  return hasChanges ? newChildren : children;
};

import { useCallback } from 'react';
import { KonvaEventObject } from 'konva/lib/Node';
import Konva from 'konva';
import { useHoverStore, HoveredElement } from '@/features/editor/store/useHoverStore';

/** 노드의 트리 깊이 계산 (깊을수록 큰 값) */
const getNodeDepth = (node: Konva.Node): number => {
  let depth = 0;
  let current: Konva.Node | null = node;
  while (current) {
    depth++;
    current = current.getParent();
  }
  return depth;
};

/**
 * Konva 요소의 호버 효과를 관리하는 커스텀 훅
 *
 * ## 호버 효과 구현 방식
 * - store에 hoveredElement.id 설정
 * - 각 요소(KonvaRect, KonvaText, KonvaGroup)가 useIsElementHovered로 자신의 hover 상태 확인
 * - hover 시 요소 내부에서 직접 stroke 렌더링 → clip-group에 의해 자동 클리핑
 *
 * @param frameId 현재 프레임 ID
 */
export const useKonvaHover = (frameId: string) => {
  const setHoveredElement = useHoverStore((state) => state.setHoveredElement);
  const clearHover = useHoverStore((state) => state.clearHover);

  /**
   * hover 대상 노드 찾기 (id가 있는 가장 가까운 조상 또는 자신)
   */
  const findHoverTarget = useCallback(
    (node: Konva.Node): Konva.Node | null => {
      // 자신에게 유효한 id가 있으면 반환
      const selfId = node.id();
      if (selfId && selfId !== frameId) {
        return node;
      }

      // .data-group 또는 .data-frame 조상 찾기 (KonvaGroup, KonvaFrame에서 사용하는 name)
      const groupAncestor = node.findAncestor('.data-group', false);
      const frameAncestor = node.findAncestor('.data-frame', false);
      // 둘 다 있으면 더 가까운 것 선택
      const containerAncestor = groupAncestor && frameAncestor
        ? (getNodeDepth(frameAncestor) > getNodeDepth(groupAncestor) ? frameAncestor : groupAncestor)
        : (groupAncestor || frameAncestor);
      if (containerAncestor && containerAncestor.id()) {
        return containerAncestor;
      }

      // getParent 루프로 id가 있는 조상 찾기
      let current = node.getParent();
      while (current) {
        const className = current.getClassName();
        if (className === 'Layer' || className === 'Stage') {
          return null;
        }
        const id = current.id();
        if (id && id !== frameId) {
          return current;
        }
        current = current.getParent();
      }

      return null;
    },
    [frameId],
  );

  /**
   * 호버 요소 정보 생성 (Konva 노드에서 clip-group 기준 좌표 추출)
   *
   * ## 좌표 계산 방식
   * - getClientRect({ relativeTo: clipGroup })로 모든 transform이 적용된 AABB 획득
   * - 이 방식은 scale/rotation이 적용된 실제 시각적 바운딩 박스를 반환
   * - AABB(Axis-Aligned Bounding Box)이므로 rotation/offset은 0으로 설정
   */
  const createHoveredElement = useCallback(
    (node: Konva.Node): HoveredElement => {
      const clipGroup = node.findAncestor('.clip-group', true) as Konva.Container | null;

      // clip-group 기준 바운딩 박스 (모든 transform 적용됨)
      const rect = node.getClientRect({ relativeTo: clipGroup || undefined });

      return {
        id: node.id(),
        frameId,
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        // AABB이므로 rotation/offset 불필요
        rotation: 0,
        offsetX: 0,
        offsetY: 0,
      };
    },
    [frameId],
  );

  // 호버 시작 효과
  const handleElementMouseOver = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      const target = e.target;

      // Stage, Layer는 호버 효과 없음
      if (target === target.getStage() || target.getClassName() === 'Layer') return;

      const elementName = target.name();

      // 제외 대상들
      if (elementName === '_image') return;
      if (elementName === 'frame-background') return;
      if (elementName?.includes('_hover-overlay')) return;
      if (elementName?.includes('_group-overlay') || elementName?.includes('_frame-overlay')) {
        // 그룹/프레임 오버레이 → 부모 Group 정보 사용
        const parent = target.getParent();
        if (parent && parent.id()) {
          setHoveredElement(createHoveredElement(parent));
        }
        return;
      }
      if (target.findAncestor('._hover-overlay', true)) return;

      // hover 대상 찾기
      const hoverTarget = findHoverTarget(target);
      if (!hoverTarget) return;

      setHoveredElement(createHoveredElement(hoverTarget));
    },
    [createHoveredElement, findHoverTarget, setHoveredElement],
  );

  // 호버 종료 효과
  const handleElementMouseOut = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      const target = e.target;

      // Stage, Layer는 호버 효과 없음
      if (target === target.getStage() || target.getClassName() === 'Layer') return;

      const elementName = target.name();

      // 제외 대상들은 clearHover 호출 안 함
      if (elementName === '_image') return;
      if (target.findAncestor('._hover-overlay', true)) return;

      clearHover();
    },
    [clearHover],
  );

  return {
    handleElementMouseOver,
    handleElementMouseOut,
  };
};

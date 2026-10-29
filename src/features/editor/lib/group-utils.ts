/**
 * group-utils.ts
 * 논리적 컨테이너(KonvaGroup, KonvaFrame) 식별 및 조작 유틸리티
 *
 * 논리적 컨테이너로 취급되는 요소:
 * - KonvaGroup: 논리적 그룹 (data-group)
 * - KonvaFrame: 중첩 Frame (data-frame)
 * - 다른 Group들: UI 래퍼일 뿐, 컨테이너 아님
 */

import Konva from 'konva';

/** 논리적 그룹 식별자 (KonvaGroup의 name 속성에 포함) */
export const LOGICAL_GROUP_NAME = 'data-group';

/** 논리적 프레임 식별자 (KonvaFrame의 name 속성에 포함) */
export const LOGICAL_FRAME_NAME = 'data-frame';

/**
 * Konva Node가 논리적 그룹(KonvaGroup)인지 확인
 * KonvaGroup에서 렌더링한 Group만 name에 'data-group' 포함
 */
export const isLogicalGroup = (node: Konva.Node): boolean => node.hasName(LOGICAL_GROUP_NAME);

/**
 * Konva Node가 논리적 프레임(KonvaFrame)인지 확인
 * KonvaFrame에서 렌더링한 Group만 name에 'data-frame' 포함
 */
export const isLogicalFrame = (node: Konva.Node): boolean => node.hasName(LOGICAL_FRAME_NAME);

/**
 * Konva Node가 논리적 컨테이너(Group 또는 Frame)인지 확인
 */
export const isLogicalContainer = (node: Konva.Node): boolean =>
  isLogicalGroup(node) || isLogicalFrame(node);

/**
 * 클릭한 노드의 가장 가까운 논리적 그룹 부모 찾기
 * Konva 표준 API 사용: findAncestor('.data-group')
 */
export const findLogicalGroupParent = (node: Konva.Node): Konva.Group | null =>
  node.findAncestor(`.${LOGICAL_GROUP_NAME}`) as Konva.Group | null;

/**
 * 클릭한 노드의 가장 가까운 논리적 컨테이너(Group 또는 Frame) 부모 찾기
 */
export const findLogicalContainerParent = (node: Konva.Node): Konva.Group | null => {
  const groupParent = node.findAncestor(`.${LOGICAL_GROUP_NAME}`) as Konva.Group | null;
  const frameParent = node.findAncestor(`.${LOGICAL_FRAME_NAME}`) as Konva.Group | null;

  // 둘 다 있으면 더 가까운 것 반환 (깊이 비교)
  if (groupParent && frameParent) {
    const groupDepth = getNodeDepth(groupParent);
    const frameDepth = getNodeDepth(frameParent);
    return frameDepth > groupDepth ? frameParent : groupParent;
  }

  return groupParent || frameParent;
};

/**
 * 노드의 트리 깊이 계산 (깊을수록 큰 값)
 */
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
 * 특정 노드가 주어진 그룹 내부에 있는지 확인
 * Konva 표준 API 사용: findAncestor('#groupId')
 */
export const isNodeInsideGroup = (node: Konva.Node, groupId: string): boolean =>
  node.findAncestor(`#${groupId}`) !== null;

/**
 * 특정 노드가 논리적 컨테이너(Group 또는 Frame) 내부에 있는지 확인
 */
export const isNodeInsideContainer = (node: Konva.Node): boolean =>
  node.findAncestor(`.${LOGICAL_GROUP_NAME}`) !== null ||
  node.findAncestor(`.${LOGICAL_FRAME_NAME}`) !== null;

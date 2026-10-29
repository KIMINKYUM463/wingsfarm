/**
 * 스냅 가이드라인 유틸리티
 *
 * Konva 공식 Objects Snapping 데모 기반 구현
 * https://konvajs.org/docs/sandbox/Objects_Snapping.html
 *
 * ## 가이드라인 표시 기준
 *
 * 1. **스냅 대상 (LineGuideStops)**
 *    - 프레임 경계: 좌(0), 중앙(width/2), 우(width) / 상(0), 중앙(height/2), 하(height)
 *    - 다른 요소들: 각 요소의 좌/중/우, 상/중/하 가장자리 (총 6개 포인트)
 *
 * 2. **드래그 중인 요소의 스냅 포인트 (ObjectSnappingEdges)**
 *    - 좌(x), 중앙(x + width/2), 우(x + width)
 *    - 상(y), 중앙(y + height/2), 하(y + height)
 *
 * 3. **스냅 발동 조건**
 *    - 드래그 요소의 스냅 포인트가 스냅 대상과 SNAP_OFFSET(5px) 이내로 가까워지면
 *    - 가이드라인(파란 점선) 표시 + 해당 위치로 자석처럼 스냅
 *
 * 4. **제외 대상**
 *    - 자기 자신 및 다중 선택된 요소들
 *    - UI 요소 (name이 _ 로 시작, frame-background 등)
 *    - 논리적 컨테이너(data-group, data-frame) 내부의 자식 요소들 (컨테이너 전체로만 스냅)
 */

import Konva from 'konva';
import { SNAP_OFFSET } from '../constants/snap';

/** 스냅 포인트 타입 (시작/중앙/끝) */
export type SnapPoint = 'start' | 'center' | 'end';

/** 스냅 방향 */
export type SnapOrientation = 'V' | 'H';

/** 스냅 대상 좌표 모음 */
export interface LineGuideStops {
  vertical: number[];
  horizontal: number[];
}

/** 드래그 중인 객체의 스냅 가능 지점 */
export interface ObjectSnappingEdge {
  guide: number;
  offset: number;
  snap: SnapPoint;
}

export interface ObjectSnappingEdges {
  vertical: ObjectSnappingEdge[];
  horizontal: ObjectSnappingEdge[];
}

/** 활성화된 가이드라인 */
export interface Guide {
  lineGuide: number;
  offset: number;
  orientation: SnapOrientation;
  snap: SnapPoint;
}

/**
 * 스냅 대상 좌표 수집
 * - 프레임 경계 (좌, 중앙, 우 / 상, 중앙, 하)
 * - 다른 모든 요소의 가장자리와 중심
 *
 * @param layer - 현재 레이어
 * @param skipNodes - 제외할 노드들 (드래그 중인 노드 + Transformer에 연결된 노드들)
 * @param frameWidth - 프레임 너비
 * @param frameHeight - 프레임 높이
 */
export function getLineGuideStops(
  layer: Konva.Layer,
  skipNodes: Konva.Node[],
  frameWidth: number,
  frameHeight: number,
): LineGuideStops {
  // 프레임 경계 + 중심
  const vertical: number[] = [0, frameWidth / 2, frameWidth];
  const horizontal: number[] = [0, frameHeight / 2, frameHeight];

  const skipIds = new Set(skipNodes.map((n) => n.id()));

  // clip-group 내의 draggable 요소들만 대상으로
  const clipGroup = layer.findOne('.clip-group') as Konva.Group | undefined;
  if (!clipGroup) return { vertical, horizontal };

  clipGroup.find((node: Konva.Node) => {
    // id가 없는 요소 제외 (wrapper 등)
    if (!node.id()) return false;
    // 자기 자신과 선택된 노드들 제외
    if (skipIds.has(node.id())) return false;
    // UI 요소 제외 (name이 _ 또는 frame-background)
    const name = node.name();
    if (name.startsWith('_') || name === 'frame-background' || name === 'clip-group') return false;
    // draggable인 요소만
    if (!node.draggable()) return false;
    // 논리적 컨테이너(data-group, data-frame) 내부의 자식 제외 (컨테이너 전체로만 스냅)
    if (node.findAncestor('.data-group') || node.findAncestor('.data-frame')) return false;
    return true;
  }).forEach((guideItem: Konva.Node) => {
    const box = guideItem.getClientRect({ relativeTo: clipGroup });
    // 좌측, 중앙, 우측
    vertical.push(box.x, box.x + box.width / 2, box.x + box.width);
    // 상단, 중앙, 하단
    horizontal.push(box.y, box.y + box.height / 2, box.y + box.height);
  });

  return { vertical, horizontal };
}

/**
 * 드래그 중인 객체의 스냅 포인트 계산
 * - 좌/중/우, 상/중/하 6개 포인트
 *
 * @param node - 드래그 중인 노드
 * @param relativeTo - 좌표 기준 컨테이너
 */
export function getObjectSnappingEdges(
  node: Konva.Node,
  relativeTo: Konva.Container,
): ObjectSnappingEdges {
  const box = node.getClientRect({ relativeTo });
  const pos = node.position();

  return {
    vertical: [
      { guide: Math.round(box.x), offset: Math.round(pos.x - box.x), snap: 'start' },
      {
        guide: Math.round(box.x + box.width / 2),
        offset: Math.round(pos.x - box.x - box.width / 2),
        snap: 'center',
      },
      {
        guide: Math.round(box.x + box.width),
        offset: Math.round(pos.x - box.x - box.width),
        snap: 'end',
      },
    ],
    horizontal: [
      { guide: Math.round(box.y), offset: Math.round(pos.y - box.y), snap: 'start' },
      {
        guide: Math.round(box.y + box.height / 2),
        offset: Math.round(pos.y - box.y - box.height / 2),
        snap: 'center',
      },
      {
        guide: Math.round(box.y + box.height),
        offset: Math.round(pos.y - box.y - box.height),
        snap: 'end',
      },
    ],
  };
}

/**
 * 다중 선택 시 전체 바운딩 박스의 스냅 포인트 계산
 *
 * @param nodes - Transformer에 연결된 모든 노드
 * @param relativeTo - 좌표 기준 컨테이너
 * @param targetNode - 드래그 중인 노드 (offset 계산 기준, 없으면 nodes[0] 사용)
 */
export function getMultiSelectionSnappingEdges(
  nodes: Konva.Node[],
  relativeTo: Konva.Container,
  targetNode?: Konva.Node,
): ObjectSnappingEdges {
  if (nodes.length === 0) {
    return { vertical: [], horizontal: [] };
  }

  // 전체 바운딩 박스 계산
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  nodes.forEach((node) => {
    const box = node.getClientRect({ relativeTo });
    minX = Math.min(minX, box.x);
    minY = Math.min(minY, box.y);
    maxX = Math.max(maxX, box.x + box.width);
    maxY = Math.max(maxY, box.y + box.height);
  });

  const width = maxX - minX;
  const height = maxY - minY;

  // 드래그 대상 노드 기준으로 offset 계산 (없으면 nodes[0] 사용)
  const refNode = targetNode || nodes[0];
  const refPos = refNode.position();

  return {
    vertical: [
      { guide: Math.round(minX), offset: Math.round(refPos.x - minX), snap: 'start' },
      {
        guide: Math.round(minX + width / 2),
        offset: Math.round(refPos.x - (minX + width / 2)),
        snap: 'center',
      },
      {
        guide: Math.round(maxX),
        offset: Math.round(refPos.x - maxX),
        snap: 'end',
      },
    ],
    horizontal: [
      { guide: Math.round(minY), offset: Math.round(refPos.y - minY), snap: 'start' },
      {
        guide: Math.round(minY + height / 2),
        offset: Math.round(refPos.y - (minY + height / 2)),
        snap: 'center',
      },
      {
        guide: Math.round(maxY),
        offset: Math.round(refPos.y - maxY),
        snap: 'end',
      },
    ],
  };
}

/**
 * 스냅 가능한 가이드라인 찾기
 * - SNAP_OFFSET 거리 내에 있는 가이드라인만 반환
 * - 가장 가까운 것 하나씩만 (수직/수평 각각)
 */
export function getGuides(lineGuideStops: LineGuideStops, itemBounds: ObjectSnappingEdges): Guide[] {
  const resultV: Array<{ lineGuide: number; diff: number; snap: SnapPoint; offset: number }> = [];
  const resultH: Array<{ lineGuide: number; diff: number; snap: SnapPoint; offset: number }> = [];

  // 수직 가이드라인 검사
  lineGuideStops.vertical.forEach((lineGuide) => {
    itemBounds.vertical.forEach((itemBound) => {
      const diff = Math.abs(lineGuide - itemBound.guide);
      if (diff < SNAP_OFFSET) {
        resultV.push({
          lineGuide,
          diff,
          snap: itemBound.snap,
          offset: itemBound.offset,
        });
      }
    });
  });

  // 수평 가이드라인 검사
  lineGuideStops.horizontal.forEach((lineGuide) => {
    itemBounds.horizontal.forEach((itemBound) => {
      const diff = Math.abs(lineGuide - itemBound.guide);
      if (diff < SNAP_OFFSET) {
        resultH.push({
          lineGuide,
          diff,
          snap: itemBound.snap,
          offset: itemBound.offset,
        });
      }
    });
  });

  const guides: Guide[] = [];

  // 가장 가까운 수직 스냅
  const minV = resultV.sort((a, b) => a.diff - b.diff)[0];
  if (minV) {
    guides.push({
      lineGuide: minV.lineGuide,
      offset: minV.offset,
      orientation: 'V',
      snap: minV.snap,
    });
  }

  // 가장 가까운 수평 스냅
  const minH = resultH.sort((a, b) => a.diff - b.diff)[0];
  if (minH) {
    guides.push({
      lineGuide: minH.lineGuide,
      offset: minH.offset,
      orientation: 'H',
      snap: minH.snap,
    });
  }

  return guides;
}

/**
 * 스냅 위치 계산 (위치 보정)
 */
export function applySnap(
  currentPos: { x: number; y: number },
  guides: Guide[],
): { x: number; y: number } {
  const newPos = { ...currentPos };

  guides.forEach((guide) => {
    if (guide.orientation === 'V') {
      newPos.x = guide.lineGuide + guide.offset;
    } else if (guide.orientation === 'H') {
      newPos.y = guide.lineGuide + guide.offset;
    }
  });

  return newPos;
}

/**
 * Active anchor 기반으로 스냅 edge 필터링
 * - 리사이즈 시 드래그하는 edge만 스냅 체크
 *
 * @param edges - 전체 스냅 edge
 * @param activeAnchor - Transformer의 active anchor 이름
 */
export function filterEdgesByAnchor(
  edges: ObjectSnappingEdges,
  activeAnchor: string | null,
): ObjectSnappingEdges {
  if (!activeAnchor || activeAnchor === 'rotater') {
    return { vertical: [], horizontal: [] };
  }

  // anchor별 체크할 edge 정의
  // vertical: 'start'=left, 'end'=right
  // horizontal: 'start'=top, 'end'=bottom
  const anchorEdgeMap: Record<string, { vertical: SnapPoint[]; horizontal: SnapPoint[] }> = {
    'top-left': { vertical: ['start'], horizontal: ['start'] },
    'top-center': { vertical: [], horizontal: ['start'] },
    'top-right': { vertical: ['end'], horizontal: ['start'] },
    'middle-left': { vertical: ['start'], horizontal: [] },
    'middle-right': { vertical: ['end'], horizontal: [] },
    'bottom-left': { vertical: ['start'], horizontal: ['end'] },
    'bottom-center': { vertical: [], horizontal: ['end'] },
    'bottom-right': { vertical: ['end'], horizontal: ['end'] },
  };

  const allowedEdges = anchorEdgeMap[activeAnchor];
  if (!allowedEdges) {
    return edges; // 알 수 없는 anchor면 전체 반환
  }

  return {
    vertical: edges.vertical.filter((e) => allowedEdges.vertical.includes(e.snap)),
    horizontal: edges.horizontal.filter((e) => allowedEdges.horizontal.includes(e.snap)),
  };
}

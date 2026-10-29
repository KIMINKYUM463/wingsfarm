import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import {
  KonvaElement,
  KonvaGroupElement,
  isKonvaGroupElement,
  isKonvaFrameElement,
  isKonvaTextElement,
  isKonvaContainerElement,
} from '@/shared/types/konva';
import { useCanvasDataStore, recordHistoryIfNeeded } from './useCanvasDataStore';
import { useSelectionStore } from './useSelectionStore';
import { useHoverStore } from './useHoverStore';
import { useModeStore } from './useModeStore';
import { useToolPanelStore } from './useToolPanelStore';
import { useClipboardStore } from './useClipboardStore';
import { generateId } from '../lib/id-generator';
import { getSelectionType } from '../lib/selection-type';
import { updateFrameChildren } from '../lib/frame-utils';
import { addElementsToMap } from '../hooks/frame/utils';
import { findElementById, findParentContainer } from '../lib/element-finder';
import { getClientRect } from '@/utils/geometry';

/**
 * 요소와 모든 자식의 ID를 수집
 */
const collectElementIds = (element: KonvaElement): string[] => {
  const ids = [element.id];
  if (isKonvaGroupElement(element) || isKonvaFrameElement(element)) {
    element.children.forEach((child) => {
      ids.push(...collectElementIds(child));
    });
  }
  return ids;
};

/**
 * 프레임에 요소를 추가하는 공통 로직
 * - frames 배열 불변 업데이트
 * - flatElements Map 업데이트
 * - 새 요소 선택
 */
const insertElementToFrame = (frameId: string, element: KonvaElement) => {
  recordHistoryIfNeeded();
  const { frames, flatElements } = useCanvasDataStore.getState();
  const frame = frames.find((f) => f.id === frameId);

  if (!frame || !isKonvaFrameElement(frame)) {
    console.warn(`Frame with ID ${frameId} not found.`);
    return;
  }

  // 불변 업데이트: frames 배열
  const newFrames = frames.map((f) => {
    if (f.id === frameId) {
      return { ...f, children: [...f.children, element] };
    }
    return f;
  });

  // flatElements Map 업데이트
  const newFlatElements = new Map(flatElements);
  newFlatElements.set(element.id, element);

  useCanvasDataStore.setState({
    frames: newFrames,
    flatElements: newFlatElements,
  });

  // 새로 추가된 요소 선택 (렌더링 후 elementRefs 등록 대기)
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      useSelectionStore
        .getState()
        .setSelectedItems([{ id: element.id, type: element.type, rootId: frameId }]);
      useModeStore.getState().selectElement(element.id);
    });
  });
};

/**
 * 그룹의 변환(회전/스케일)을 적용하여 자식의 절대 좌표 계산
 * - offset 고려: 자식 좌표를 회전 중심 기준으로 변환
 * - 좌표: offset 보정 → 스케일 → 회전 → 이동 변환
 * - 크기: 스케일 적용 (width/height 또는 radius에 bake)
 *
 * ## Shape 타입별 처리
 * - Rect/Text/Path: width/height에 스케일 bake
 * - Circle/RegularPolygon: radius에 스케일 bake (keepRatio이므로 scaleX만 사용)
 * - Ellipse: radiusX/radiusY에 각각 스케일 bake
 * - Star: innerRadius/outerRadius에 스케일 bake
 * - Line/Arrow: scale 유지 (points 배열 기반)
 */
const transformChildToAbsolute = (
  child: KonvaElement,
  group: {
    x: number;
    y: number;
    offsetX?: number;
    offsetY?: number;
    rotation?: number;
    scaleX?: number;
    scaleY?: number;
  },
): KonvaElement => {
  const rad = ((group.rotation || 0) * Math.PI) / 180;
  const groupScaleX = group.scaleX ?? 1;
  const groupScaleY = group.scaleY ?? 1;
  const groupOffsetX = group.offsetX ?? 0;
  const groupOffsetY = group.offsetY ?? 0;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  // 자식 좌표를 회전 중심(x, y) 기준으로 변환
  // 콘텐츠 시작점 = (x - offsetX, y - offsetY)
  // 자식의 회전 중심 기준 상대 좌표 = childPos - offset
  const relX = child.x - groupOffsetX;
  const relY = child.y - groupOffsetY;

  // 좌표 변환: 스케일 → 회전 → 이동
  const scaledX = relX * groupScaleX;
  const scaledY = relY * groupScaleY;

  // 자식 스케일과 그룹 스케일 합성
  const childScaleX = child.scaleX ?? 1;
  const childScaleY = child.scaleY ?? 1;
  const finalScaleX = childScaleX * groupScaleX;
  const finalScaleY = childScaleY * groupScaleY;

  // 공통 변환 속성 (좌표, 회전)
  const baseTransform = {
    x: group.x + scaledX * cos - scaledY * sin,
    y: group.y + scaledX * sin + scaledY * cos,
    rotation: (child.rotation || 0) + (group.rotation || 0),
  };

  // 음수 스케일(flip) 처리용 부호
  const signX = Math.sign(finalScaleX) || 1;
  const signY = Math.sign(finalScaleY) || 1;

  // Shape 타입별 스케일 처리
  const childAny = child as KonvaElement & {
    width?: number;
    height?: number;
    radius?: number;
    radiusX?: number;
    radiusY?: number;
    innerRadius?: number;
    outerRadius?: number;
  };

  // Circle: radius에 스케일 bake (keepRatio이므로 scaleX만 사용)
  if (child.type === 'circle' && childAny.radius !== undefined) {
    return {
      ...child,
      ...baseTransform,
      radius: Math.abs(childAny.radius * finalScaleX),
      scaleX: signX,
      scaleY: signY,
    };
  }

  // Ellipse: radiusX/radiusY에 각각 스케일 bake
  if (child.type === 'ellipse' && childAny.radiusX !== undefined && childAny.radiusY !== undefined) {
    return {
      ...child,
      ...baseTransform,
      radiusX: Math.abs(childAny.radiusX * finalScaleX),
      radiusY: Math.abs(childAny.radiusY * finalScaleY),
      scaleX: signX,
      scaleY: signY,
    };
  }

  // Star: innerRadius/outerRadius에 스케일 bake (keepRatio이므로 scaleX만 사용)
  if (
    child.type === 'star' &&
    childAny.innerRadius !== undefined &&
    childAny.outerRadius !== undefined
  ) {
    return {
      ...child,
      ...baseTransform,
      innerRadius: Math.abs(childAny.innerRadius * finalScaleX),
      outerRadius: Math.abs(childAny.outerRadius * finalScaleX),
      scaleX: signX,
      scaleY: signY,
    };
  }

  // RegularPolygon: radius에 스케일 bake (keepRatio이므로 scaleX만 사용)
  if (child.type === 'regularPolygon' && childAny.radius !== undefined) {
    return {
      ...child,
      ...baseTransform,
      radius: Math.abs(childAny.radius * finalScaleX),
      scaleX: signX,
      scaleY: signY,
    };
  }

  // Line/Arrow: scale 그대로 유지 (points 배열 기반이라 스케일 bake 복잡)
  if (child.type === 'line' || child.type === 'arrow') {
    return {
      ...child,
      ...baseTransform,
      scaleX: finalScaleX,
      scaleY: finalScaleY,
    };
  }

  // Rect/Text/Path 등: width/height에 스케일 bake
  const hasSize = childAny.width !== undefined && childAny.height !== undefined;

  return {
    ...child,
    ...baseTransform,
    // 크기가 있으면 스케일을 bake, 없으면 스케일 유지
    // 음수 스케일(flip) 처리: 크기는 절대값으로, flip은 부호로 유지
    ...(hasSize
      ? {
          width: Math.abs((childAny.width as number) * finalScaleX),
          height: Math.abs((childAny.height as number) * finalScaleY),
          scaleX: signX,
          scaleY: signY,
        }
      : {
          scaleX: finalScaleX,
          scaleY: finalScaleY,
        }),
  };
};

/**
 * 그룹화할 요소들을 완전히 펼침 (재귀적으로 모든 중첩 그룹 해제)
 * - 일반 요소: 그대로 반환
 * - 그룹 요소: 자식들을 절대 좌표로 변환 (회전/스케일 포함), 중첩 그룹도 재귀 처리
 */
const flattenElementsForGrouping = (elements: KonvaElement[]) => {
  const flattenedElements: KonvaElement[] = [];
  const groupIdsToRemove: string[] = [];

  const flattenRecursive = (el: KonvaElement, parentGroup?: KonvaGroupElement) => {
    // 부모 그룹이 있으면 절대 좌표로 변환
    const transformedEl = parentGroup ? transformChildToAbsolute(el, parentGroup) : el;

    if (isKonvaGroupElement(el)) {
      // 그룹 제거 대상에 추가
      groupIdsToRemove.push(el.id);
      // 변환된 그룹을 부모로 사용하여 자식들 재귀 처리
      const transformedGroup = transformedEl as KonvaGroupElement;
      el.children.forEach((child) => {
        flattenRecursive(child, transformedGroup);
      });
    } else {
      flattenedElements.push(transformedEl);
    }
  };

  elements.forEach((el) => flattenRecursive(el));

  return { flattenedElements, groupIdsToRemove };
};

/**
 * 요소를 깊은 복제 (모든 자식 ID도 새로 생성)
 * 중첩 Frame도 복제 가능 (children 재귀 복제)
 */
const deepCloneWithNewIds = (element: KonvaElement, rootId: string): KonvaElement => {
  // 중첩 Frame 복제: 새 ID 생성, rootId 명시적 설정, children 재귀 복제
  if (isKonvaFrameElement(element)) {
    return {
      ...element,
      id: generateId(),
      rootId,
      children: element.children.map((child) => deepCloneWithNewIds(child, rootId)),
    } as KonvaElement;
  }

  // 일반 요소: rootId 포함하여 복제
  const baseClone = {
    ...element,
    id: generateId(),
    rootId,
  };

  // Group/NestedFrame: children 재귀 복제
  if (isKonvaContainerElement(element)) {
    return {
      ...baseClone,
      children: element.children.map((child) => deepCloneWithNewIds(child, rootId)),
    } as KonvaElement;
  }

  return baseClone as KonvaElement;
};

/**
 * 여러 요소의 레이어 순서를 일괄 변경 (상대 순서 유지)
 * - top: 선택된 요소들을 맨 위로 (상대 순서 유지)
 * - up: 선택된 요소들을 한 칸 위로
 * - down: 선택된 요소들을 한 칸 아래로
 * - bottom: 선택된 요소들을 맨 아래로 (상대 순서 유지)
 *
 * ## 그룹 내부 요소 처리
 * - 그룹 내부 요소 선택 시 → 그룹 전체의 레이어가 변경됨
 * - 중첩 그룹 내부 요소 선택 시 → 프레임 직속 최상위 그룹의 레이어가 변경됨
 */
const reorderElements = (elementIds: string[], direction: 'top' | 'up' | 'down' | 'bottom') => {
  if (elementIds.length === 0) return;

  recordHistoryIfNeeded();
  const { frames } = useCanvasDataStore.getState();

  // 프레임별 레이어 변경 대상 ID 수집 (프레임 직속 요소로 해석)
  // 그룹 내부 요소 → 해당 그룹의 프레임 직속 조상으로 변환
  const targetsByFrame = new Map<string, Set<string>>();

  elementIds.forEach((elementId) => {
    for (const frame of frames) {
      if (!isKonvaFrameElement(frame)) continue;

      // 1) 프레임 직속 자식인지 확인 (O(n) 단일 순회)
      const isDirectChild = frame.children.some((child) => child.id === elementId);
      if (isDirectChild) {
        const existing = targetsByFrame.get(frame.id) ?? new Set();
        existing.add(elementId);
        targetsByFrame.set(frame.id, existing);
        return; // found, exit forEach for this elementId
      }

      // 2) 프레임 직속 컨테이너(Group/NestedFrame) 중 해당 요소를 포함하는 컨테이너 찾기
      for (const child of frame.children) {
        if (isKonvaContainerElement(child)) {
          const found = findElementById([child], elementId);
          if (found) {
            // 컨테이너 내부 요소 → 컨테이너 자체를 레이어 변경 대상으로
            const existing = targetsByFrame.get(frame.id) ?? new Set();
            existing.add(child.id);
            targetsByFrame.set(frame.id, existing);
            return; // found, exit forEach for this elementId
          }
        }
      }
    }
  });

  // 각 부모 컨테이너별로 children 재정렬
  const reorderChildrenBatch = (children: KonvaElement[], targetIds: string[]): KonvaElement[] => {
    const targetIdSet = new Set(targetIds);

    // 선택된 요소들과 나머지 요소들 분리 (상대 순서 유지)
    const selectedElements: KonvaElement[] = [];
    const otherElements: KonvaElement[] = [];

    children.forEach((el) => {
      if (targetIdSet.has(el.id)) {
        selectedElements.push(el);
      } else {
        otherElements.push(el);
      }
    });

    // 경계 체크: 이미 해당 방향 끝에 있으면 변경 없음
    if (selectedElements.length === 0) return children;

    const firstSelectedIdx = children.findIndex((el) => targetIdSet.has(el.id));
    const lastSelectedIdx =
      children.length - 1 - [...children].reverse().findIndex((el) => targetIdSet.has(el.id));

    if (direction === 'top' && lastSelectedIdx === children.length - 1) return children;
    if (direction === 'up' && lastSelectedIdx === children.length - 1) return children;
    if (direction === 'down' && firstSelectedIdx === 0) return children;
    if (direction === 'bottom' && firstSelectedIdx === 0) return children;

    switch (direction) {
      case 'top':
        // 나머지 요소들 먼저, 선택된 요소들 맨 뒤 (상대 순서 유지)
        return [...otherElements, ...selectedElements];

      case 'bottom':
        // 선택된 요소들 먼저, 나머지 요소들 뒤 (상대 순서 유지)
        return [...selectedElements, ...otherElements];

      case 'up': {
        // 선택된 요소들 바로 위의 요소 하나를 아래로 이동
        // 예: [A, B, C, D] (B, C 선택) → [A, D, B, C]? 아니, [B, C, A, D]
        // 실제로는: 선택된 요소들 그룹을 한 칸 위로
        const result = [...children];
        // 선택된 요소들 중 가장 뒤에 있는 것의 다음 요소를 찾아서 앞으로 이동
        if (lastSelectedIdx < children.length - 1) {
          const elementToMoveDown = result[lastSelectedIdx + 1];
          // 선택된 요소들의 첫 번째 위치로 이동
          result.splice(lastSelectedIdx + 1, 1);
          result.splice(firstSelectedIdx, 0, elementToMoveDown);
        }
        return result;
      }

      case 'down': {
        // 선택된 요소들 바로 아래의 요소 하나를 위로 이동
        const result = [...children];
        if (firstSelectedIdx > 0) {
          const elementToMoveUp = result[firstSelectedIdx - 1];
          // 선택된 요소들의 마지막 위치 다음으로 이동
          result.splice(firstSelectedIdx - 1, 1);
          result.splice(lastSelectedIdx, 0, elementToMoveUp);
        }
        return result;
      }

      default:
        return children;
    }
  };

  // 프레임 트리 업데이트 (프레임 직속 children만 재정렬)
  let newFrames = frames;

  targetsByFrame.forEach((targetIdSet, frameId) => {
    const targetIds = Array.from(targetIdSet);

    newFrames = updateFrameChildren(newFrames, frameId, (children) => {
      return reorderChildrenBatch(children, targetIds);
    });
  });

  useCanvasDataStore.setState({ frames: newFrames });
};

/**
 * 요소 관리 저장소 (하이브리드 방식)
 * 책임: 개별 요소의 CRUD 작업만 담당
 * - updateElement: useCanvasDataStore로 위임 (불변성 유지)
 * - 기타 CRUD: 불변성 있는 업데이트로 자동 리렌더링
 */
interface ElementState {
  // 요소 조회
  getElement: (elementId: string) => KonvaElement | undefined;
  getTextElement: (elementId: string) => KonvaElement | undefined;

  // 요소 업데이트
  updateElement: (elementId: string, updates: Partial<KonvaElement>) => void;

  // 요소 삭제
  deleteElement: (elementId: string) => void;

  // 요소 복제 (단일)
  duplicateElement: (elementId: string) => void;

  // 요소 복제 (다중) - 복제된 요소들 선택
  duplicateElements: (elementIds: string[]) => void;

  // 텍스트 추가
  addTextToFrame: (frameId: string) => void;

  // 이미지 추가 (position: 드롭 위치, 없으면 프레임 중앙)
  addImageToFrame: (
    frameId: string,
    assetId: string,
    imageUrl: string,
    position?: { x: number; y: number },
  ) => void;

  // 도형/선 추가 - 생성된 요소 ID 반환
  addShapeToFrame: (
    frameId: string,
    defaultProps: Partial<KonvaElement> & { type: string },
  ) => string | undefined;

  // 그래픽 추가 (이미지지만 SHAPE로 분류) - 생성된 요소 ID 반환
  addGraphicToFrame: (
    frameId: string,
    assetId: string,
    imageUrl: string,
    size?: { width: number; height: number },
  ) => string | undefined;

  // 요소를 다른 프레임으로 이동 (position: 드롭 위치, 없으면 기존 좌표 유지)
  moveElementToFrame: (
    elementId: string,
    toFrameId: string,
    position?: { x: number; y: number },
  ) => void;

  // 그룹 생성 (선택된 요소들을 그룹으로 묶기)
  createGroup: (frameId: string, elementIds: string[]) => void;

  // 그룹 해제
  ungroupElements: (groupId: string) => void;

  // 요소 붙여넣기 (클립보드에서)
  pasteElements: (frameId: string, elements: KonvaElement[]) => void;

  // 레이어 순서 변경 (단일)
  moveToTop: (elementId: string) => void; // 맨 앞으로
  moveUp: (elementId: string) => void; // 앞으로
  moveDown: (elementId: string) => void; // 뒤로
  moveToBottom: (elementId: string) => void; // 맨 뒤로

  // 레이어 순서 변경 (다중 - 상대 순서 유지)
  moveElementsToTop: (elementIds: string[]) => void;
  moveElementsUp: (elementIds: string[]) => void;
  moveElementsDown: (elementIds: string[]) => void;
  moveElementsToBottom: (elementIds: string[]) => void;
}

export const useElementStore = create<ElementState>()(
  devtools(
    (_set, get) => ({
      getElement: (elementId: string) => {
        const { flatElements } = useCanvasDataStore.getState();
        return flatElements.get(elementId);
      },

      getTextElement: (elementId: string) => {
        const element = get().getElement(elementId);
        return element && isKonvaTextElement(element) ? element : undefined;
      },

      updateElement: (elementId: string, updates: Partial<KonvaElement>) => {
        // useCanvasDataStore로 위임 (불변성 있는 업데이트)
        useCanvasDataStore.getState().updateElement(elementId, updates);
      },

      deleteElement: (elementId: string) => {
        recordHistoryIfNeeded();
        const { frames, flatElements } = useCanvasDataStore.getState();
        const elementToDelete = flatElements.get(elementId);

        if (!elementToDelete) return;

        // rootId로 해당 프레임만 식별
        const targetFrameId = (elementToDelete as { rootId?: string }).rootId;
        if (!targetFrameId) {
          console.warn(`Cannot delete element without rootId: ${elementId}`);
          return;
        }

        // 삭제할 요소와 모든 자식 ID 수집 (flatElements 동기화용)
        const idsToDelete = new Set(collectElementIds(elementToDelete));

        // 재귀적으로 요소 제거 + 빈 그룹 정리 (불변성 유지, Structural Sharing)
        const removeFromChildren = (elements: KonvaElement[]): KonvaElement[] => {
          let hasChanges = false;

          const filtered = elements.filter((el) => {
            if (el.id === elementId) {
              hasChanges = true;
              return false;
            }
            return true;
          });

          const mapped = filtered.map((element) => {
            if (!isKonvaGroupElement(element) && !isKonvaFrameElement(element)) return element;

            const newChildren = removeFromChildren(element.children);
            if (newChildren === element.children) return element; // 참조 유지

            hasChanges = true;
            return { ...element, children: newChildren } as KonvaElement;
          });

          // 빈 그룹 제거 (Frame은 유지 - 빈 프레임도 의미 있음)
          const withoutEmptyGroups = mapped.filter((element) => {
            if (isKonvaGroupElement(element) && element.children.length === 0) {
              hasChanges = true;
              idsToDelete.add(element.id); // flatElements에서도 제거
              return false;
            }
            return true;
          });

          return hasChanges ? withoutEmptyGroups : elements;
        };

        // 해당 프레임만 불변 업데이트 (다른 프레임은 참조 유지)
        const newFrames = updateFrameChildren(frames, targetFrameId, removeFromChildren);

        // 삭제 대상 요소와 모든 자식을 flatElements에서 제거
        const newFlatElements = new Map(flatElements);
        idsToDelete.forEach((id) => newFlatElements.delete(id));

        useCanvasDataStore.setState({
          frames: newFrames,
          flatElements: newFlatElements,
        });

        useSelectionStore.getState().clearSelection();
      },

      duplicateElement: (elementId: string) => {
        recordHistoryIfNeeded();
        const { frames, flatElements } = useCanvasDataStore.getState();
        const elementToDuplicate = flatElements.get(elementId);

        if (!elementToDuplicate) return;

        // rootId로 해당 프레임만 식별
        const targetFrameId = (elementToDuplicate as { rootId?: string }).rootId;
        if (!targetFrameId) {
          console.warn(`Cannot duplicate element without rootId: ${elementId}`);
          return;
        }

        // 요소 깊은 복제 (모든 자식 ID도 새로 생성)
        const duplicatedElement = deepCloneWithNewIds(elementToDuplicate, targetFrameId);
        duplicatedElement.name = elementToDuplicate.name.includes('copy')
          ? elementToDuplicate.name
          : `${elementToDuplicate.name} copy`;
        duplicatedElement.x = elementToDuplicate.x + 20;
        duplicatedElement.y = elementToDuplicate.y + 20;

        // 부모 컨테이너에 복제된 요소 추가 (불변성 유지, Structural Sharing)
        const addDuplicatedElement = (elements: KonvaElement[]): KonvaElement[] => {
          let hasChanges = false;

          const result = elements.flatMap((element) => {
            // 타겟 요소 발견: 원본 + 복제본 추가
            if (element.id === elementId) {
              hasChanges = true;
              return [element, duplicatedElement];
            }

            // 컨테이너: children 재귀 탐색
            if (isKonvaGroupElement(element) || isKonvaFrameElement(element)) {
              const newChildren = addDuplicatedElement(element.children);
              if (newChildren === element.children) return element; // 참조 유지

              hasChanges = true;
              return { ...element, children: newChildren } as KonvaElement;
            }

            return element;
          });

          return hasChanges ? result : elements;
        };

        // 해당 프레임만 불변 업데이트 (다른 프레임은 참조 유지)
        const newFrames = updateFrameChildren(frames, targetFrameId, addDuplicatedElement);

        // 복제된 요소와 모든 자식을 flatElements에 추가
        const newFlatElements = new Map(flatElements);
        addElementsToMap(duplicatedElement, newFlatElements);

        useCanvasDataStore.setState({
          frames: newFrames,
          flatElements: newFlatElements,
        });

        // 복제된 요소 선택
        requestAnimationFrame(() => {
          useSelectionStore.getState().setSelectedItems([
            {
              id: duplicatedElement.id,
              type: duplicatedElement.type,
              rootId: targetFrameId,
            },
          ]);
        });
      },

      duplicateElements: (elementIds: string[]) => {
        recordHistoryIfNeeded();
        const { frames, flatElements } = useCanvasDataStore.getState();
        const duplicatedItems: { id: string; type: string; rootId: string }[] = [];

        let currentFrames = frames;
        let currentFlatElements = new Map(flatElements);

        elementIds.forEach((elementId) => {
          const elementToDuplicate = currentFlatElements.get(elementId);
          if (!elementToDuplicate) return;

          const targetFrameId = (elementToDuplicate as { rootId?: string }).rootId;
          if (!targetFrameId) return;

          // 요소 깊은 복제
          const duplicatedElement = deepCloneWithNewIds(elementToDuplicate, targetFrameId);
          duplicatedElement.name = elementToDuplicate.name.includes('copy')
            ? elementToDuplicate.name
            : `${elementToDuplicate.name} copy`;
          duplicatedElement.x = elementToDuplicate.x + 20;
          duplicatedElement.y = elementToDuplicate.y + 20;

          // 프레임에 복제본 추가
          const addDuplicatedElement = (elements: KonvaElement[]): KonvaElement[] => {
            let hasChanges = false;
            const result = elements.flatMap((element) => {
              if (element.id === elementId) {
                hasChanges = true;
                return [element, duplicatedElement];
              }
              if (isKonvaGroupElement(element) || isKonvaFrameElement(element)) {
                const newChildren = addDuplicatedElement(element.children);
                if (newChildren === element.children) return element;
                hasChanges = true;
                return { ...element, children: newChildren } as KonvaElement;
              }
              return element;
            });
            return hasChanges ? result : elements;
          };

          currentFrames = updateFrameChildren(currentFrames, targetFrameId, addDuplicatedElement);
          addElementsToMap(duplicatedElement, currentFlatElements);

          duplicatedItems.push({
            id: duplicatedElement.id,
            type: duplicatedElement.type,
            rootId: targetFrameId,
          });
        });

        useCanvasDataStore.setState({
          frames: currentFrames,
          flatElements: currentFlatElements,
        });

        // 복제된 모든 요소 선택
        if (duplicatedItems.length > 0) {
          requestAnimationFrame(() => {
            useSelectionStore.getState().setSelectedItems(duplicatedItems);
          });
        }
      },

      addTextToFrame: (frameId: string) => {
        const { frames } = useCanvasDataStore.getState();
        const frame = frames.find((f) => f.id === frameId);

        if (!frame || !isKonvaFrameElement(frame)) {
          console.warn(`Frame with ID ${frameId} not found.`);
          return;
        }

        const textWidth = 200;
        const textHeight = 40;
        const centerX = (frame.width ?? 860) / 2 - textWidth / 2;
        const centerY = (frame.height ?? 1080) / 2 - textHeight / 2;

        // 기본 텍스트 요소 생성
        const newText: KonvaElement = {
          id: generateId(),
          type: 'text' as const,
          name: '새 텍스트',
          x: centerX,
          y: centerY,
          width: textWidth,
          height: textHeight,
          visible: true,
          opacity: 1,
          rotation: 0,
          text: '텍스트를 입력하세요',
          fontSize: 24,
          fontFamily: 'Pretendard',
          fontStyle: 'normal',
          fontWeight: 400,
          fill: '#000000',
          align: 'center',
          verticalAlign: 'middle',
          lineHeight: 1.2,
          rootId: frame.id,
        };

        insertElementToFrame(frameId, newText);
      },

      addImageToFrame: (
        frameId: string,
        assetId: string,
        imageUrl: string,
        position?: { x: number; y: number },
      ) => {
        const { frames, setAssetUrl } = useCanvasDataStore.getState();
        const frame = frames.find((f) => f.id === frameId);

        if (!frame || !isKonvaFrameElement(frame)) {
          console.warn(`Frame with ID ${frameId} not found.`);
          return;
        }

        // assetUrl 등록 (이미지 렌더링에 필요)
        setAssetUrl(assetId, imageUrl);

        // 기본 이미지 크기 (정사각형)
        const imageSize = 300;

        // position이 있으면 드롭 위치 기준, 없으면 프레임 중앙
        const x = position ? position.x - imageSize / 2 : (frame.width ?? 860) / 2 - imageSize / 2;
        const y = position
          ? position.y - imageSize / 2
          : (frame.height ?? 1080) / 2 - imageSize / 2;

        // 이미지 요소 생성 (rect with assetId)
        const newImage: KonvaElement = {
          id: generateId(),
          type: 'rect' as const,
          name: '_image',
          x,
          y,
          width: imageSize,
          height: imageSize,
          visible: true,
          opacity: 1,
          rotation: 0,
          assetId,
          rootId: frame.id,
        };

        insertElementToFrame(frameId, newImage);
      },

      addShapeToFrame: (
        frameId: string,
        defaultProps: Partial<KonvaElement> & { type: string },
      ) => {
        const { frames } = useCanvasDataStore.getState();
        const frame = frames.find((f) => f.id === frameId);

        if (!frame || !isKonvaFrameElement(frame)) {
          console.warn(`Frame with ID ${frameId} not found.`);
          return undefined;
        }

        // 프레임 중앙에 배치
        const frameWidth = frame.width ?? 860;
        const frameHeight = frame.height ?? 1080;

        // 도형 요소 생성
        const newId = generateId();
        const newShape: KonvaElement = {
          id: newId,
          visible: true,
          opacity: 1,
          rotation: 0,
          rootId: frame.id,
          ...defaultProps,
          // 위치는 프레임 중앙
          x: frameWidth / 2,
          y: frameHeight / 2,
        } as KonvaElement;

        insertElementToFrame(frameId, newShape);
        return newId;
      },

      addGraphicToFrame: (
        frameId: string,
        assetId: string,
        imageUrl: string,
        size?: { width: number; height: number },
      ) => {
        const { frames, setAssetUrl } = useCanvasDataStore.getState();
        const frame = frames.find((f) => f.id === frameId);

        if (!frame || !isKonvaFrameElement(frame)) {
          console.warn(`Frame with ID ${frameId} not found.`);
          return undefined;
        }

        // assetUrl 등록 (이미지 렌더링에 필요)
        setAssetUrl(assetId, imageUrl);

        // 크기 결정: 원본 크기 또는 기본값 200
        const width = size?.width ?? 200;
        const height = size?.height ?? 200;

        // 프레임 중앙에 배치
        const x = (frame.width ?? 860) / 2 - width / 2;
        const y = (frame.height ?? 1080) / 2 - height / 2;

        const newId = generateId();

        // 그래픽 요소 생성 (rect with assetId, name: '_graphic')
        const newGraphic: KonvaElement = {
          id: newId,
          type: 'rect' as const,
          name: '_graphic',
          x,
          y,
          width,
          height,
          visible: true,
          opacity: 1,
          rotation: 0,
          assetId,
          rootId: frame.id,
        };

        insertElementToFrame(frameId, newGraphic);
        return newId;
      },

      moveElementToFrame: (
        elementId: string,
        toFrameId: string,
        position?: { x: number; y: number },
      ) => {
        recordHistoryIfNeeded();
        const { frames, flatElements } = useCanvasDataStore.getState();
        const elementToMove = flatElements.get(elementId);

        if (!elementToMove) return;

        // 현재 프레임 식별
        const fromFrameId = (elementToMove as { rootId?: string }).rootId;
        if (!fromFrameId) {
          console.warn(`Cannot move element without rootId: ${elementId}`);
          return;
        }

        // 같은 프레임이면 무시
        if (fromFrameId === toFrameId) return;

        // 대상 프레임 확인
        const toFrame = frames.find((f) => f.id === toFrameId);
        if (!toFrame || !isKonvaFrameElement(toFrame)) {
          console.warn(`Target frame not found: ${toFrameId}`);
          return;
        }

        // rootId 업데이트 함수 (자식 포함)
        const updateRootId = (element: KonvaElement, newRootId: string): KonvaElement => {
          const updated = { ...element, rootId: newRootId };
          if (isKonvaGroupElement(element) || isKonvaFrameElement(element)) {
            return {
              ...updated,
              children: element.children.map((child) => updateRootId(child, newRootId)),
            } as KonvaElement;
          }
          return updated as KonvaElement;
        };

        // 이동할 요소 (rootId 변경 + 드롭 위치 적용)
        const movedElement = updateRootId(elementToMove, toFrameId);
        if (position) {
          movedElement.x = position.x;
          movedElement.y = position.y;
        }

        // 원본 프레임에서 요소 제거
        const removeFromChildren = (elements: KonvaElement[]): KonvaElement[] => {
          let hasChanges = false;

          const filtered = elements.filter((el) => {
            if (el.id === elementId) {
              hasChanges = true;
              return false;
            }
            return true;
          });

          const mapped = filtered.map((element) => {
            if (!isKonvaGroupElement(element) && !isKonvaFrameElement(element)) return element;

            const newChildren = removeFromChildren(element.children);
            if (newChildren === element.children) return element;

            hasChanges = true;
            return { ...element, children: newChildren } as KonvaElement;
          });

          return hasChanges ? mapped : elements;
        };

        // 원본 프레임 업데이트
        let newFrames = updateFrameChildren(frames, fromFrameId, removeFromChildren);

        // 대상 프레임에 요소 추가
        newFrames = newFrames.map((f) => {
          if (f.id === toFrameId) {
            return { ...f, children: [...f.children, movedElement] };
          }
          return f;
        });

        // flatElements 업데이트 (rootId 변경된 요소들)
        const newFlatElements = new Map(flatElements);
        const updateFlatElements = (element: KonvaElement) => {
          newFlatElements.set(element.id, element);
          if (isKonvaGroupElement(element) || isKonvaFrameElement(element)) {
            element.children.forEach(updateFlatElements);
          }
        };
        updateFlatElements(movedElement);

        useCanvasDataStore.setState({
          frames: newFrames,
          flatElements: newFlatElements,
        });

        // 이동된 요소 선택 (rootId 기반 필터링으로 타이밍 무관하게 동작)
        useSelectionStore
          .getState()
          .setSelectedItems([{ id: movedElement.id, type: movedElement.type, rootId: toFrameId }]);
        useModeStore.getState().selectElement(movedElement.id);
      },

      createGroup: (frameId: string, elementIds: string[]) => {
        recordHistoryIfNeeded();

        // 선택/호버 해제 (Transformer 즉시 숨김 + stale hover 방지)
        useSelectionStore.getState().clearSelection();
        useHoverStore.getState().clearHover();

        const { frames, flatElements } = useCanvasDataStore.getState();
        const frame = frames.find((f) => f.id === frameId);

        if (!frame || !isKonvaFrameElement(frame)) return;

        // 그룹화할 요소들 조회 (frames 트리에서 찾아야 children 좌표가 최신)
        const elementsToGroup = elementIds
          .map((id) => findElementById(frames, id))
          .filter((el): el is KonvaElement => el !== undefined);

        if (elementsToGroup.length < 2) return;

        // 모든 요소의 직접 부모 컨테이너 찾기
        const parentContainers = elementIds.map((id) => findParentContainer(frames, id));
        const firstParent = parentContainers[0];

        // 모든 요소가 같은 부모를 공유하는지 확인
        const allSameParent = parentContainers.every((p) => p?.id === firstParent?.id);
        if (!allSameParent || !firstParent) {
          console.warn('Cannot group elements from different parent containers');
          return;
        }

        // 기존 그룹은 펼쳐서 자식들만 포함 (재귀적으로 모든 중첩 그룹 해제)
        const { flattenedElements, groupIdsToRemove } = flattenElementsForGrouping(elementsToGroup);

        // bounds 계산 (회전/스케일/offset 고려)
        let minX = Infinity,
          minY = Infinity,
          maxX = -Infinity,
          maxY = -Infinity;

        flattenedElements.forEach((el) => {
          const rect = getClientRect(el);
          minX = Math.min(minX, rect.x);
          minY = Math.min(minY, rect.y);
          maxX = Math.max(maxX, rect.x + rect.width);
          maxY = Math.max(maxY, rect.y + rect.height);
        });

        // 그룹 크기 및 중심점 계산
        const groupWidth = maxX - minX;
        const groupHeight = maxY - minY;
        const centerX = minX + groupWidth / 2;
        const centerY = minY + groupHeight / 2;

        // 새 그룹 생성 (Konva 정중앙 회전: offset으로 중심점 설정)
        // - x, y = 회전 중심점 (정중앙)
        // - offsetX, offsetY = width/2, height/2 (콘텐츠를 중심으로 이동)
        // - 자식들은 bounds 좌상단(0,0) 기준으로 배치
        const newGroupId = generateId();
        const groupChildren = flattenedElements.map((el) => {
          const newX = el.x - minX;
          const newY = el.y - minY;
          return {
            ...el,
            x: newX,
            y: newY,
            rootId: frameId,
          };
        });

        const newGroup: KonvaGroupElement = {
          id: newGroupId,
          type: 'group' as const,
          name: '그룹',
          x: centerX, // 회전 중심점 X
          y: centerY, // 회전 중심점 Y
          width: groupWidth, // 그룹 크기 (Transformer, 바운딩 박스 계산용)
          height: groupHeight,
          offsetX: groupWidth / 2, // 콘텐츠 중심으로 offset
          offsetY: groupHeight / 2,
          visible: true,
          opacity: 1,
          rotation: 0,
          children: groupChildren,
          rootId: frameId,
        };

        // 프레임에서 원본 요소 제거 + 그룹 추가
        const elementIdSet = new Set(elementIds);

        // 원본 요소 제거 + 공통 부모에 그룹 추가
        const updateChildren = (elements: KonvaElement[]): KonvaElement[] => {
          // 원본 요소 제거
          const filtered = elements.filter((el) => !elementIdSet.has(el.id));

          // 중첩된 그룹/프레임 내부도 처리
          const mapped = filtered.map((element) => {
            if (!isKonvaGroupElement(element) && !isKonvaFrameElement(element)) return element;

            const newChildren = updateChildren(element.children);

            // 이 컨테이너가 공통 부모면 그룹 추가
            if (element.id === firstParent.id) {
              return { ...element, children: [...newChildren, newGroup] } as KonvaElement;
            }

            if (newChildren === element.children) return element;

            return { ...element, children: newChildren } as KonvaElement;
          });

          return mapped;
        };

        const newFrames = frames.map((f) => {
          if (f.id === frameId) {
            const updatedChildren = updateChildren(f.children);
            // 루트 프레임이 공통 부모인 경우에만 여기서 그룹 추가
            if (firstParent.id === frameId) {
              return { ...f, children: [...updatedChildren, newGroup] };
            }
            return { ...f, children: updatedChildren };
          }
          return f;
        });

        // flatElements 업데이트
        const newFlatElements = new Map(flatElements);
        // 원본 요소 및 펼쳐진 그룹 제거
        [...elementIds, ...groupIdsToRemove].forEach((id) => newFlatElements.delete(id));
        // 그룹과 자식 추가
        addElementsToMap(newGroup, newFlatElements);

        useCanvasDataStore.setState({
          frames: newFrames,
          flatElements: newFlatElements,
        });

        // 새 그룹 선택 + Tool 연동
        // React의 useEffect에서 Transformer 노드 동기화가 처리되므로 rAF 불필요
        const selectedItems = [{ id: newGroupId, type: 'group' as const, rootId: frameId }];
        useSelectionStore.getState().setSelectedItems(selectedItems);

        const toolType = getSelectionType(selectedItems, get().getElement);
        if (toolType !== null) {
          useToolPanelStore.getState().setSelectedTool(toolType);
        }
      },

      ungroupElements: (groupId: string) => {
        recordHistoryIfNeeded();

        // 선택/호버 해제 (Transformer 즉시 숨김 + stale hover 방지)
        useSelectionStore.getState().clearSelection();
        useHoverStore.getState().clearHover();

        const { frames, flatElements } = useCanvasDataStore.getState();

        // flatElements가 아닌 frames 트리에서 그룹을 찾음 (자식 좌표가 최신 상태)
        const groupElement = findElementById(frames, groupId);

        if (!groupElement || (!isKonvaGroupElement(groupElement) && !isKonvaFrameElement(groupElement))) {
          console.warn(`Group/Frame with ID ${groupId} not found or not a container.`);
          return;
        }

        const frameId = (groupElement as { rootId?: string }).rootId;
        if (!frameId) {
          console.warn(`Cannot ungroup element without rootId: ${groupId}`);
          return;
        }

        // 그룹의 children을 절대 좌표로 변환 (회전/스케일 포함)
        const ungrouppedElements = groupElement.children.map((child) => ({
          ...transformChildToAbsolute(child, groupElement),
          rootId: frameId,
        }));

        // 그룹 제거 + 자식 요소들 추가
        const removeGroupAndAddChildren = (elements: KonvaElement[]): KonvaElement[] => {
          let hasChanges = false;

          const result = elements.flatMap((element) => {
            // 그룹 발견: 제거하고 자식들로 대체
            if (element.id === groupId) {
              hasChanges = true;
              return ungrouppedElements;
            }

            // 컨테이너: children 재귀 탐색
            if (isKonvaGroupElement(element) || isKonvaFrameElement(element)) {
              const newChildren = removeGroupAndAddChildren(element.children);
              if (newChildren === element.children) return element;

              hasChanges = true;
              return { ...element, children: newChildren } as KonvaElement;
            }

            return element;
          });

          return hasChanges ? result : elements;
        };

        const newFrames = updateFrameChildren(frames, frameId, removeGroupAndAddChildren);

        // flatElements 업데이트
        const newFlatElements = new Map(flatElements);
        // 그룹 제거
        newFlatElements.delete(groupId);
        // 해제된 요소들 추가
        ungrouppedElements.forEach((el) => {
          addElementsToMap(el, newFlatElements);
        });

        useCanvasDataStore.setState({
          frames: newFrames,
          flatElements: newFlatElements,
        });
      },

      pasteElements: (frameId: string, elements: KonvaElement[]) => {
        if (elements.length === 0) return;

        recordHistoryIfNeeded();
        const { frames, flatElements } = useCanvasDataStore.getState();
        const frame = frames.find((f) => f.id === frameId);

        if (!frame || !isKonvaFrameElement(frame)) {
          console.warn(`Frame with ID ${frameId} not found.`);
          return;
        }

        // 클립보드에서 원본 프레임 ID 확인
        const { sourceFrameId, getNextPasteOffset } = useClipboardStore.getState();
        const isDifferentFrame = sourceFrameId !== frameId;
        const offset = getNextPasteOffset();

        // 다른 프레임에 붙여넣기 시: 프레임 중앙에 배치
        let baseOffsetX = 0;
        let baseOffsetY = 0;

        if (isDifferentFrame) {
          // 요소들의 바운딩 박스 계산 (모든 shape 타입 지원 - radius 기반 포함)
          // getClientRect는 회전/스케일/offset을 고려하여 정확한 bounds 반환
          const rects = elements.map((el) => getClientRect(el));
          const minX = Math.min(...rects.map((r) => r.x));
          const minY = Math.min(...rects.map((r) => r.y));
          const maxX = Math.max(...rects.map((r) => r.x + r.width));
          const maxY = Math.max(...rects.map((r) => r.y + r.height));
          const elementsWidth = maxX - minX;
          const elementsHeight = maxY - minY;

          // 프레임 중앙 좌표
          const frameCenterX = (frame.width ?? 860) / 2;
          const frameCenterY = (frame.height ?? 1080) / 2;

          // 요소들을 프레임 중앙에 배치하기 위한 오프셋
          baseOffsetX = frameCenterX - elementsWidth / 2 - minX;
          baseOffsetY = frameCenterY - elementsHeight / 2 - minY;
        }

        // 복제된 요소들 (새 ID 생성)
        const pastedElements = elements.map((element) => {
          const pasted = deepCloneWithNewIds(element, frameId);
          pasted.x = element.x + baseOffsetX + offset;
          pasted.y = element.y + baseOffsetY + offset;
          return pasted;
        });

        // 프레임에 추가
        const newFrames = frames.map((f) => {
          if (f.id === frameId) {
            return { ...f, children: [...f.children, ...pastedElements] };
          }
          return f;
        });

        // flatElements 업데이트
        const newFlatElements = new Map(flatElements);
        pastedElements.forEach((el) => {
          addElementsToMap(el, newFlatElements);
        });

        useCanvasDataStore.setState({
          frames: newFrames,
          flatElements: newFlatElements,
        });

        // 붙여넣기된 요소들 선택
        requestAnimationFrame(() => {
          useSelectionStore.getState().setSelectedItems(
            pastedElements.map((el) => ({
              id: el.id,
              type: el.type,
              rootId: frameId,
            })),
          );
        });
      },

      // ===== 레이어 순서 변경 =====

      moveToTop: (elementId: string) => {
        reorderElements([elementId], 'top');
      },

      moveUp: (elementId: string) => {
        reorderElements([elementId], 'up');
      },

      moveDown: (elementId: string) => {
        reorderElements([elementId], 'down');
      },

      moveToBottom: (elementId: string) => {
        reorderElements([elementId], 'bottom');
      },

      // ===== 레이어 순서 변경 (다중) =====

      moveElementsToTop: (elementIds: string[]) => {
        reorderElements(elementIds, 'top');
      },

      moveElementsUp: (elementIds: string[]) => {
        reorderElements(elementIds, 'up');
      },

      moveElementsDown: (elementIds: string[]) => {
        reorderElements(elementIds, 'down');
      },

      moveElementsToBottom: (elementIds: string[]) => {
        reorderElements(elementIds, 'bottom');
      },
    }),
    { name: 'element-store' },
  ),
);

import {
  KonvaElement,
  KonvaFrameElement,
  KonvaGroupElement,
  isKonvaGroupElement,
  isKonvaFrameElement,
} from '@/shared/types/konva';

/**
 * 재귀적으로 요소를 찾는 헬퍼 함수
 */
export const findElementById = (
  elements: KonvaElement[],
  elementId: string,
): KonvaElement | undefined => {
  for (const element of elements) {
    if (element.id === elementId) {
      return element;
    }
    if (isKonvaGroupElement(element) || isKonvaFrameElement(element)) {
      const found = findElementById(element.children, elementId);
      if (found) return found;
    }
  }
  return undefined;
};

/**
 * 프레임들에서 요소를 찾는 헬퍼 함수
 */
export const findElementInFrames = (
  frames: KonvaElement[],
  elementId: string,
): KonvaElement | undefined => {
  for (const frame of frames) {
    if (isKonvaFrameElement(frame)) {
      const found = findElementById(frame.children, elementId);
      if (found) return found;
    }
  }
  return undefined;
};

/**
 * 요소가 속한 부모 frame을 찾는 헬퍼 함수
 */
export const findParentFrame = (
  frames: KonvaFrameElement[],
  elementId: string,
): KonvaFrameElement | undefined => {
  for (const frame of frames) {
    // frame 자체가 해당 id면 자기 자신 반환
    if (frame.id === elementId) {
      return frame;
    }
    // frame의 children에서 찾으면 이 frame이 부모
    const found = findElementById(frame.children, elementId);
    if (found) {
      return frame;
    }
  }
  return undefined;
};

/**
 * 이미지 렌더링 대상 요소인지 확인 (assetId로 이미지를 표시하는 요소)
 * - assetId가 있으면 이미지 렌더링 대상 (가장 확실한 판단 기준)
 * - 또는 name에 '_image' 또는 '_graphic'이 포함된 경우 (레거시 호환)
 * - type이 'path' 또는 'rect'인 경우만 해당
 * (Group은 이미지 컨테이너일 뿐 실제 이미지 요소가 아님)
 */
export const hasAssetImage = (element: { name?: string; type?: string; assetId?: string }): boolean => {
  if (element.type !== 'path' && element.type !== 'rect') return false;

  // assetId가 있으면 이미지 렌더링 대상
  if (element.assetId) return true;

  // 레거시 호환: name 기반 판단 (아직 assetId가 할당되지 않은 placeholder 요소)
  const name = element.name;
  if (!name) return false;
  return name.includes('_image') || name.includes('_graphic');
};

/**
 * 이미지 교체 가능한 요소인지 확인 (호버 시 업로드 UI 표시)
 * - name에 '_image'가 포함된 요소만 해당
 * - '_graphic' 요소는 미리 정의된 그래픽이므로 교체 UI 불필요
 */
export const isImageElement = (element: { name?: string; type?: string }): boolean => {
  if (!element.name?.includes('_image')) return false;
  return element.type === 'path' || element.type === 'rect';
};

/** 사진이 아직 없는 이미지 자리 (숨긴 요소 제외) — 다운로드 전 안내·빈 자리 이동에 사용 */
export const findBlankImageSlots = (elements: KonvaElement[]): KonvaElement[] =>
  elements.flatMap((element) => {
    if (element.visible === false) return [];
    if (isKonvaGroupElement(element) || isKonvaFrameElement(element)) return findBlankImageSlots(element.children);
    return isImageElement(element) && !('assetId' in element && element.assetId) ? [element] : [];
  });

/**
 * 이미지가 채워진 도형인지 확인 (그래픽 패널에서 편집)
 * - assetId가 있는 rect
 * - 단, name이 '_graphic'이나 '_image'가 아닌 것 (예: "image 294")
 */
export const isFilledShapeElement = (element: { name?: string; type?: string; assetId?: string }): boolean => {
  if (element.type !== 'rect') return false;
  if (!element.assetId) return false;

  const name = element.name || '';
  return !name.includes('_graphic') && !name.includes('_image');
};

/**
 * 요소의 직접 부모 컨테이너(Group 또는 Frame)를 찾기
 * - 프레임 직속 요소 → 프레임 반환
 * - 그룹 내 요소 → 그룹 반환
 */
export const findParentContainer = (
  frames: KonvaFrameElement[],
  elementId: string,
): KonvaGroupElement | KonvaFrameElement | undefined => {
  const searchInChildren = (
    parent: KonvaGroupElement | KonvaFrameElement,
    targetId: string,
  ): KonvaGroupElement | KonvaFrameElement | undefined => {
    for (const child of parent.children) {
      if (child.id === targetId) {
        return parent; // 현재 parent가 직접 부모
      }
      if (isKonvaGroupElement(child) || isKonvaFrameElement(child)) {
        const found = searchInChildren(child, targetId);
        if (found) return found;
      }
    }
    return undefined;
  };

  for (const frame of frames) {
    if (frame.id === elementId) return undefined; // 프레임 자체는 부모 없음
    const found = searchInChildren(frame, elementId);
    if (found) return found;
  }
  return undefined;
};

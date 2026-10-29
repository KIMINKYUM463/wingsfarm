import {
  KonvaElement,
  isKonvaGroupElement,
  isKonvaFrameElement,
} from '@/shared/types/konva';
import { generateId } from './id-generator';

/**
 * 요소를 깊은 복사로 복제 (children 포함)
 */
export const cloneElement = (element: KonvaElement): KonvaElement => {
  const newId = generateId();
  const cloned = {
    ...element,
    id: newId,
    name: element.name.includes('copy') ? element.name : `${element.name} copy`,
  };

  // children이 있는 경우 재귀적으로 복제
  if (isKonvaGroupElement(cloned) || isKonvaFrameElement(cloned)) {
    const originalElement = element as typeof cloned;
    cloned.children = originalElement.children.map((child) => cloneElement(child));
  }

  return cloned;
};

/**
 * 요소를 복제하되 name은 그대로 유지 (children도 name 유지)
 */
export const cloneElementPreserveName = (element: KonvaElement): KonvaElement => {
  const cloned = { ...element };

  if (isKonvaGroupElement(element) && isKonvaGroupElement(cloned)) {
    cloned.children = element.children.map((child) => cloneElementPreserveName(child));
  } else if (isKonvaFrameElement(element) && isKonvaFrameElement(cloned)) {
    cloned.children = element.children.map((child) => cloneElementPreserveName(child));
  }

  return cloned;
};

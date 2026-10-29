import { KonvaElement } from '../../types';
import { AbsolutePosition } from '../../utils/coordinate-utils';

/**
 * 컨테이너 노드(Frame, Group 등)를 변환하는 인터페이스
 * 자식 요소들을 포함하는 노드의 변환을 담당
 */
export interface ContainerConverter {
  /**
   * 컨테이너 노드를 Konva 요소로 변환
   * @param node - 변환할 Figma 노드
   * @param children - 이미 변환된 자식 요소들
   * @param parentAbsolutePosition - 부모의 절대 좌표
   * @returns 변환된 Konva 요소
   */
  convert(
    node: any,
    children: KonvaElement[],
    parentAbsolutePosition?: AbsolutePosition,
  ): KonvaElement;
}

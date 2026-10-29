import { KonvaElement } from '../../types';
import { AbsolutePosition } from '../../utils/coordinate-utils';

/**
 * Shape 노드(그리기 가능한 요소)를 변환하는 인터페이스
 * Text, Rectangle, Ellipse, Vector, Image 등의 변환을 담당
 */
export interface ShapeConverter {
  /**
   * Shape 노드를 Konva 요소로 변환
   * @param node - 변환할 Figma 노드
   * @param parentAbsolutePosition - 부모의 절대 좌표
   * @returns 변환된 Konva 요소
   */
  convert(node: any, parentAbsolutePosition?: AbsolutePosition): KonvaElement;
}

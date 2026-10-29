import { StyleMapper } from '../../mappers/StyleMapper';
import { KonvaElement } from '../../types';
import { placeNode, AbsolutePosition } from '../../utils/coordinate-utils';
import { ShapeConverter } from '../interfaces/ShapeConverter';

/** 보이는 이미지 채우기의 imageRef (없으면 undefined) */
export const findImageRef = (node: any): string | undefined =>
  node.fills?.find((fill: any) => fill?.type === 'IMAGE' && fill.visible !== false && fill.imageRef)
    ?.imageRef;

/**
 * 이미지 채우기를 가진 노드 → figmaImageRef를 가진 rect
 *
 * 에디터는 rect의 assetId로 이미지를 그리므로, 서버가 템플릿을 프로젝트에 넣을 때
 * figmaImageRef를 assetId로 바꿔 준다. (이름이 `_image`면 상품 사진 자리)
 */
export class ImageConverter implements ShapeConverter {
  constructor(private styleMapper: StyleMapper) {}

  convert(node: any, parentAbsolutePosition?: AbsolutePosition): KonvaElement {
    const placement = placeNode(node, parentAbsolutePosition);
    const isEllipse = node.type === 'ELLIPSE';

    return {
      type: 'rect',
      id: node.id,
      name: node.name,
      ...placement,
      figmaImageRef: findImageRef(node),
      cornerRadius: isEllipse
        ? Math.min(placement.width, placement.height) / 2
        : this.styleMapper.mapCornerRadius(node.rectangleCornerRadii || node.cornerRadius),
      visible: this.styleMapper.mapVisible(node.visible),
      opacity: this.styleMapper.mapOpacity(node.opacity),
    };
  }
}

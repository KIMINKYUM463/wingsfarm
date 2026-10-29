import { StyleMapper } from '../../mappers/StyleMapper';
import { KonvaElement } from '../../types';
import { convertElementCoordinates, AbsolutePosition } from '../../utils/coordinate-utils';
import { ShapeConverter } from '../interfaces/ShapeConverter';

export class EllipseConverter implements ShapeConverter {
  constructor(private styleMapper: StyleMapper) {}

  convert(node: any, parentAbsolutePosition?: AbsolutePosition): KonvaElement {
    const boundingBox = node.absoluteBoundingBox || { x: 0, y: 0, width: 0, height: 0 };
    const fillConfig = this.styleMapper.mapFills(node.fills);
    const strokeConfig = this.styleMapper.mapStrokes(node.strokes);

    // 부모 기준 상대좌표 계산
    const relativePosition = convertElementCoordinates(boundingBox, parentAbsolutePosition);

    const radiusX = boundingBox.width / 2;
    const radiusY = boundingBox.height / 2;

    return {
      type: 'ellipse',
      id: node.id,
      name: node.name,
      x: relativePosition.x + radiusX,
      y: relativePosition.y + radiusY,
      radiusX: radiusX,
      radiusY: radiusY,
      ...fillConfig,
      ...strokeConfig,
      visible: this.styleMapper.mapVisible(node.visible),
      opacity: this.styleMapper.mapOpacity(node.opacity),
    };
  }
}

import { StyleMapper } from '../../mappers/StyleMapper';
import { KonvaElement } from '../../types';
import { placeNode, AbsolutePosition } from '../../utils/coordinate-utils';
import { ShapeConverter } from '../interfaces/ShapeConverter';

export class RectangleConverter implements ShapeConverter {
  constructor(private styleMapper: StyleMapper) {}

  convert(node: any, parentAbsolutePosition?: AbsolutePosition): KonvaElement {
    const placement = placeNode(node, parentAbsolutePosition);
    const fillConfig = this.styleMapper.mapFills(node.fills, placement);
    const strokeConfig = this.styleMapper.mapFills(node.strokes);

    return {
      type: 'rect',
      id: node.id,
      name: node.name,
      ...placement,
      ...fillConfig,
      fillPriority: fillConfig?.fillPriority || 'color',
      cornerRadius: this.styleMapper.mapCornerRadius(
        node.rectangleCornerRadii || node.cornerRadius,
      ),
      stroke: strokeConfig?.fill,
      strokeWidth: strokeConfig?.fill && node.strokeWeight !== undefined ? node.strokeWeight : undefined,
      visible: this.styleMapper.mapVisible(node.visible),
      opacity: this.styleMapper.mapOpacity(node.opacity),
    };
  }
}

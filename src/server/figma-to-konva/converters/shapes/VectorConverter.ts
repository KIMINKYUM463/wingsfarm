import { StyleMapper } from '../../mappers/StyleMapper';
import { KonvaElement } from '../../types';
import { placeNode, AbsolutePosition } from '../../utils/coordinate-utils';
import { ShapeConverter } from '../interfaces/ShapeConverter';

/**
 * 벡터 계열(VECTOR, ELLIPSE, STAR, BOOLEAN_OPERATION 등) → Konva Path
 * - fillGeometry / strokeGeometry는 노드 로컬 좌표이므로 노드 배치값(placeNode)만 적용하면 된다.
 */
export class VectorConverter implements ShapeConverter {
  constructor(private styleMapper: StyleMapper) {}

  convert(node: any, parentAbsolutePosition?: AbsolutePosition): KonvaElement {
    const placement = placeNode(node, parentAbsolutePosition);
    const fillConfig = this.styleMapper.mapFills(node.fills, placement);
    const strokeColor = this.styleMapper.mapFills(node.strokes)?.fill;
    const visibility = {
      visible: this.styleMapper.mapVisible(node.visible),
      opacity: this.styleMapper.mapOpacity(node.opacity),
    };

    const toPath = (geometry: any, suffix: string, fill: Record<string, unknown>): KonvaElement => ({
      type: 'path',
      id: `${node.id}-${suffix}`,
      name: `${node.name} ${suffix}`,
      x: 0,
      y: 0,
      width: placement.width,
      height: placement.height,
      data: geometry.path,
      ...fill,
      fillRule: geometry.windingRule?.toLowerCase() || 'nonzero',
    });

    const paths: KonvaElement[] = [
      ...(node.fillGeometry ?? []).map((g: any, i: number) => toPath(g, `fill${i || ''}`, { ...fillConfig })),
      ...(strokeColor
        ? (node.strokeGeometry ?? []).map((g: any, i: number) =>
            toPath(g, `stroke${i || ''}`, { fill: strokeColor, fillPriority: 'color' }),
          )
        : []),
    ].filter((p) => (p as { data?: string }).data);

    if (paths.length === 0) return null as unknown as KonvaElement;

    if (paths.length === 1) {
      return { ...paths[0], id: node.id, name: node.name, ...placement, ...visibility };
    }

    return {
      type: 'group',
      id: node.id,
      name: node.name,
      ...placement,
      children: paths,
      ...visibility,
    };
  }
}

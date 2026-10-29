import { StyleMapper } from '../../mappers/StyleMapper';
import { KonvaElement } from '../../types';
import { placeNode, AbsolutePosition, NodePlacement } from '../../utils/coordinate-utils';
import { ShapeConverter } from '../interfaces/ShapeConverter';

/**
 * Figma 와 브라우저의 글자 폭 측정은 1px 안팎으로 다르다.
 * 내용에 딱 맞춘 자동 너비(WIDTH_AND_HEIGHT) 박스는 그 차이만으로 마지막 글자가 다음 줄로 밀려 잘리므로 여유를 둔다.
 */
const AUTO_WIDTH_SLACK = 4;

const widenAutoWidth = (placement: NodePlacement, align: string): NodePlacement => {
  if (placement.rotation) return placement;
  const shift = align === 'center' ? AUTO_WIDTH_SLACK / 2 : align === 'right' ? AUTO_WIDTH_SLACK : 0;
  return { ...placement, x: placement.x - shift, width: placement.width + AUTO_WIDTH_SLACK };
};

export class TextConverter implements ShapeConverter {
  constructor(private styleMapper: StyleMapper) {}

  convert(node: any, parentAbsolutePosition?: AbsolutePosition): KonvaElement {
    const style = node.style || {};
    const align = this.styleMapper.mapTextAlign(style.textAlignHorizontal);
    const basePlacement = placeNode(node, parentAbsolutePosition);
    const placement =
      style.textAutoResize === 'WIDTH_AND_HEIGHT' ? widenAutoWidth(basePlacement, align) : basePlacement;
    const fillConfig = this.styleMapper.mapFills(node.fills, basePlacement);

    return {
      type: 'text',
      id: node.id,
      name: node.name,
      ...placement,
      text: node.characters || '',
      fontSize: style.fontSize || 16,
      fontFamily: style.fontFamily || 'Pretendard',
      fontStyle: this.styleMapper.mapFontStyle(style.fontWeight, style.fontStyle),
      fontWeight: style.fontWeight || 400,
      ...fillConfig,
      align,
      verticalAlign: this.styleMapper.mapVerticalAlign(style.textAlignVertical),
      lineHeight: this.styleMapper.mapLineHeight(style.lineHeightPx, style.fontSize),
      letterSpacing: style.letterSpacing || 0,
      wrap: this.styleMapper.mapWrap(style.textAutoResize, node.characters),
      ellipsis: this.styleMapper.mapEllipsis(style.textTruncation),
      padding: 0,
      visible: this.styleMapper.mapVisible(node.visible),
      opacity: this.styleMapper.mapOpacity(node.opacity),
    };
  }
}

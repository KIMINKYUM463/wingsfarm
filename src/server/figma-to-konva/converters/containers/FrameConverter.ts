import { StyleMapper } from '../../mappers/StyleMapper';
import { KonvaElement } from '../../types';
import { convertElementCoordinates, AbsolutePosition } from '../../utils/coordinate-utils';
import { ContainerConverter } from '../interfaces/ContainerConverter';

export class FrameConverter implements ContainerConverter {
  constructor(private styleMapper: StyleMapper) {}

  convert(
    frame: any,
    children: KonvaElement[],
    parentAbsolutePosition?: AbsolutePosition,
  ): KonvaElement {
    const box = frame.absoluteBoundingBox || { x: 0, y: 0, width: 100, height: 100 };

    // 최상위 Frame은 (0, 0), 중첩 Frame은 부모 기준 상대좌표
    const position = parentAbsolutePosition
      ? convertElementCoordinates(box, parentAbsolutePosition)
      : { x: 0, y: 0 };
    const fillConfig = this.styleMapper.mapFills(frame.fills, box);

    return {
      type: 'frame',
      id: frame.id,
      name: frame.name,
      x: position.x,
      y: position.y,
      width: box.width,
      height: box.height,
      children,
      visible: this.styleMapper.mapVisible(frame.visible),
      opacity: this.styleMapper.mapOpacity(frame.opacity),
      ...fillConfig,
      cornerRadius: this.styleMapper.mapCornerRadius(
        frame.rectangleCornerRadii || frame.cornerRadius,
      ),
      layoutMode: this.styleMapper.mapLayoutMode(frame.layoutMode),
      padding: this.styleMapper.mapPadding(
        frame.paddingLeft,
        frame.paddingRight,
        frame.paddingTop,
        frame.paddingBottom,
      ),
      itemSpacing: this.styleMapper.mapItemSpacing(frame.itemSpacing),
      ...(frame.clipsContent && { clipX: 0, clipY: 0, clipWidth: box.width, clipHeight: box.height }),
    };
  }
}

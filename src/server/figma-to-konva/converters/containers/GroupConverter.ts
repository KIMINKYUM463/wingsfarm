import { StyleMapper } from '../../mappers/StyleMapper';
import { KonvaElement } from '../../types';
import { convertGroupCoordinates, AbsolutePosition } from '../../utils/coordinate-utils';
import { ContainerConverter } from '../interfaces/ContainerConverter';

export class GroupConverter implements ContainerConverter {
  constructor(private styleMapper: StyleMapper) {}

  convert(
    group: any,
    children: KonvaElement[],
    parentAbsolutePosition?: AbsolutePosition,
  ): KonvaElement {
    const box = group.absoluteBoundingBox || { x: 0, y: 0, width: 100, height: 100 };

    // 부모 기준 상대좌표 계산
    const relativePosition = convertGroupCoordinates(box, parentAbsolutePosition);

    return {
      type: 'group',
      id: group.id,
      name: group.name,
      x: relativePosition.x,
      y: relativePosition.y,
      width: box.width,
      height: box.height,
      children,
      visible: this.styleMapper.mapVisible(group.visible),
      opacity: this.styleMapper.mapOpacity(group.opacity),
    };
  }
}

import { StyleMapper } from '../../mappers/StyleMapper';
import { KonvaLayer } from '../../types';

export class CanvasConverter {
  constructor(private styleMapper: StyleMapper) {}

  convert(canvas: any, children: any[]): KonvaLayer {
    const box = canvas.absoluteBoundingBox || { x: 0, y: 0, width: 800, height: 600 };

    return {
      id: canvas.id,
      name: canvas.name,
      type: 'layer',
      elements: children,
      backgroundColor: this.styleMapper.mapColor(canvas.backgroundColor),
      width: box.width,
      height: box.height,
      visible: this.styleMapper.mapVisible(canvas.visible),
    };
  }
}

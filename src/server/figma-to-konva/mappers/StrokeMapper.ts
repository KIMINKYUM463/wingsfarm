// figma-to-konva/mappers/StrokeMapper.ts
import type { KonvaStrokeConfig } from '../types/konva';

/**
 * 테두리 매핑을 담당하는 클래스
 * Figma의 strokes 속성을 Konva stroke 속성으로 변환
 */
export class StrokeMapper {
  /**
   * Frame의 strokes 배열 매핑
   */
  mapStrokes(strokes?: any[]): KonvaStrokeConfig | undefined {
    if (!strokes || strokes.length === 0) {
      return undefined;
    }

    const firstStroke = strokes.find((s) => s.visible !== false);
    if (!firstStroke) {
      return undefined;
    }

    // stroke 전용 변환 로직 구현
    return this.convertStrokeToKonva(firstStroke);
  }

  /**
   * stroke를 Konva 형식으로 변환
   */
  private convertStrokeToKonva(stroke: any): KonvaStrokeConfig {
    if (stroke.type === 'SOLID' && stroke.color) {
      const { r, g, b, a } = stroke.color;
      const finalOpacity = (stroke.opacity || 1) * a;
      const rgbaColor = `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${finalOpacity})`;

      // stroke 속성을 반환하도록 수정
      return {
        stroke: rgbaColor,
      };
    }

    // 지원되지 않는 stroke 타입
    return {
      stroke: undefined,
    };
  }
}

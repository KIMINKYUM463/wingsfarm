import type { KonvaFillConfig } from '../types/konva';

/**
 * 채우기 매핑을 담당하는 클래스
 * Figma의 fills 속성을 Konva fill 속성으로 변환
 */
export class FillMapper {
  /**
   * 단일 색상 매핑 (backgroundColor용)
   */
  mapColor(color?: { r: number; g: number; b: number; a: number }): string | null {
    if (!color) {
      return null;
    }

    const { r, g, b, a } = color;
    return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${a})`;
  }

  /**
   * 채우기 배열을 Konva fill 속성으로 변환
   */
  mapFills(
    fills?: any[],
    elementSize?: { width: number; height: number },
  ): KonvaFillConfig | undefined {
    if (!this.hasValidFills(fills)) {
      return undefined;
    }

    const visibleFill = this.findVisibleFill(fills!);
    if (!visibleFill) {
      return undefined;
    }

    return this.convertFillToKonva(visibleFill, elementSize);
  }

  /**
   * 유효한 채우기 배열인지 확인
   */
  private hasValidFills(fills?: any[]): boolean {
    return fills !== undefined && fills.length > 0;
  }

  /**
   * 보이는 채우기 찾기
   * Figma에서 fills 배열의 첫 번째 visible=true인 채우기를 선택
   */
  private findVisibleFill(fills: any[]): any | undefined {
    return fills.find((fill) => this.isFillVisible(fill));
  }

  /**
   * 채우기가 보이는지 확인
   * visible 속성이 명시적으로 false가 아닌 경우 보이는 것으로 간주
   */
  private isFillVisible(fill: any): boolean {
    // null, undefined, 또는 잘못된 객체인 경우 false 반환
    if (!fill || typeof fill !== 'object') {
      return false;
    }
    return fill.visible !== false;
  }

  /**
   * 개별 채우기를 Konva 속성으로 변환
   */
  private convertFillToKonva(
    fill: any,
    elementSize?: { width: number; height: number },
  ): KonvaFillConfig {
    const supportedTypes = this.getSupportedFillTypes();

    if (supportedTypes.includes(fill.type)) {
      return this.convertSupportedFill(fill, elementSize);
    } else {
      return this.createUnsupportedFillConfig(fill);
    }
  }

  /**
   * 지원되는 채우기 타입 목록
   */
  private getSupportedFillTypes(): string[] {
    return ['SOLID', 'GRADIENT_LINEAR', 'GRADIENT_RADIAL'];
  }

  /**
   * 지원되는 채우기 타입 변환
   */
  private convertSupportedFill(
    fill: any,
    elementSize?: { width: number; height: number },
  ): KonvaFillConfig {
    switch (fill.type) {
      case 'SOLID':
        return this.convertSolidFill(fill);
      case 'GRADIENT_LINEAR':
        return this.convertLinearGradient(fill, elementSize);
      case 'GRADIENT_RADIAL':
        return this.convertRadialGradient(fill, elementSize);
      default:
        return this.createUnsupportedFillConfig(fill);
    }
  }

  /**
   * SOLID 채우기 변환
   */
  private convertSolidFill(fill: any): KonvaFillConfig {
    if (!fill.color) {
      return this.createUnsupportedFillConfig(fill);
    }

    // fill.opacity가 있으면 색상의 투명도에 곱해서 적용
    const { r, g, b, a } = fill.color;
    const finalOpacity = (fill.opacity || 1) * a;

    const rgbaColor = `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${finalOpacity})`;

    return {
      fill: rgbaColor,
      fillPriority: 'color',
    };
  }

  /**
   * LINEAR 그라데이션 변환
   */
  private convertLinearGradient(
    fill: any,
    elementSize?: { width: number; height: number },
  ): KonvaFillConfig {
    const validation = this.validateLinearGradientData(fill);
    if (!validation.isValid) {
      return this.createUnsupportedFillConfig();
    }

    const { startPoint, endPoint, colorStops } = this.extractLinearGradientData(fill, elementSize);

    return {
      fillLinearGradientStartPoint: startPoint,
      fillLinearGradientEndPoint: endPoint,
      fillLinearGradientColorStops: colorStops,
      fillPriority: 'linear-gradient',
    };
  }

  /**
   * RADIAL 그라데이션 변환
   */
  private convertRadialGradient(
    fill: any,
    elementSize?: { width: number; height: number },
  ): KonvaFillConfig {
    const validation = this.validateRadialGradientData(fill);
    if (!validation.isValid) {
      return this.createUnsupportedFillConfig();
    }

    const { startPoint, endPoint, startRadius, endRadius, colorStops } =
      this.extractRadialGradientData(fill, elementSize);

    return {
      fillRadialGradientStartPoint: startPoint,
      fillRadialGradientEndPoint: endPoint,
      fillRadialGradientStartRadius: startRadius,
      fillRadialGradientEndRadius: endRadius,
      fillRadialGradientColorStops: colorStops,
      fillPriority: 'radial-gradient',
    };
  }

  /**
   * 지원되지 않는 채우기 타입에 대한 설정 생성
   */
  private createUnsupportedFillConfig(fill?: any): KonvaFillConfig {
    const fallbackColor = this.getFallbackColor(fill?.type);

    return {
      fill: fallbackColor,
      fillPriority: 'color',
    };
  }

  /**
   * 채우기 타입별 대체 색상 반환
   */
  private getFallbackColor(fillType?: string): string {
    switch (fillType) {
      case 'GRADIENT_ANGULAR':
      case 'GRADIENT_DIAMOND':
        return 'rgba(100, 100, 100, 0.4)'; // 그라데이션 대체 색상
      case 'IMAGE':
        return 'rgba(200, 200, 200, 0.5)'; // 이미지 대체 색상
      case 'PATTERN':
        return 'rgba(150, 150, 150, 0.3)'; // 패턴 대체 색상
      default:
        return 'rgba(0, 0, 0, 0)'; // 투명 (알 수 없는 타입)
    }
  }

  /**
   * LINEAR 그라데이션 데이터 유효성 검사
   */
  private validateLinearGradientData(fill: any): { isValid: boolean } {
    if (!fill.gradientHandlePositions || fill.gradientHandlePositions.length < 2) {
      return { isValid: false };
    }

    if (!fill.gradientStops || fill.gradientStops.length === 0) {
      return { isValid: false };
    }

    return { isValid: true };
  }

  /**
   * LINEAR 그라데이션 데이터 추출
   */
  private extractLinearGradientData(
    fill: any,
    elementSize?: { width: number; height: number },
  ): {
    startPoint: { x: number; y: number };
    endPoint: { x: number; y: number };
    colorStops: (number | string)[];
  } {
    const positions = fill.gradientHandlePositions;

    if (elementSize) {
      // 정규화된 좌표(0-1)를 픽셀 좌표로 변환
      const startPoint = {
        x: positions[0].x * elementSize.width,
        y: positions[0].y * elementSize.height,
      };
      const endPoint = {
        x: positions[1].x * elementSize.width,
        y: positions[1].y * elementSize.height,
      };
      const colorStops = this.convertGradientStops(fill.gradientStops);

      return { startPoint, endPoint, colorStops };
    } else {
      // 기존 방식: 정규화된 좌표 그대로 사용
      const startPoint = { x: positions[0].x, y: positions[0].y };
      const endPoint = { x: positions[1].x, y: positions[1].y };
      const colorStops = this.convertGradientStops(fill.gradientStops);

      return { startPoint, endPoint, colorStops };
    }
  }

  /**
   * RADIAL 그라데이션 데이터 유효성 검사
   */
  private validateRadialGradientData(fill: any): { isValid: boolean } {
    if (!fill.gradientHandlePositions || fill.gradientHandlePositions.length < 2) {
      return { isValid: false };
    }

    if (!fill.gradientStops || fill.gradientStops.length === 0) {
      return { isValid: false };
    }

    return { isValid: true };
  }

  /**
   * RADIAL 그라데이션 데이터 추출
   */
  private extractRadialGradientData(
    fill: any,
    elementSize?: { width: number; height: number },
  ): {
    startPoint: { x: number; y: number };
    endPoint: { x: number; y: number };
    startRadius: number;
    endRadius: number;
    colorStops: (number | string)[];
  } {
    const positions = fill.gradientHandlePositions;

    if (elementSize) {
      // 정규화된 좌표(0-1)를 픽셀 좌표로 변환
      const startPoint = {
        x: positions[0].x * elementSize.width,
        y: positions[0].y * elementSize.height,
      };
      const endPoint = {
        x: positions[1].x * elementSize.width,
        y: positions[1].y * elementSize.height,
      };

      const { startRadius, endRadius } = this.calculateRadialRadii(startPoint, endPoint);
      const colorStops = this.convertGradientStops(fill.gradientStops);

      return { startPoint, endPoint, startRadius, endRadius, colorStops };
    } else {
      // 기존 방식: 정규화된 좌표 그대로 사용
      const startPoint = { x: positions[0].x, y: positions[0].y };
      const endPoint = { x: positions[1].x, y: positions[1].y };

      const { startRadius, endRadius } = this.calculateRadialRadii(startPoint, endPoint);
      const colorStops = this.convertGradientStops(fill.gradientStops);

      return { startPoint, endPoint, startRadius, endRadius, colorStops };
    }
  }

  /**
   * RADIAL 그라데이션의 반지름 계산
   */
  private calculateRadialRadii(
    startPoint: { x: number; y: number },
    endPoint: { x: number; y: number },
  ): { startRadius: number; endRadius: number } {
    const startRadius = 0; // 시작 반지름은 항상 0
    const endRadius = this.calculateDistance(startPoint, endPoint);

    return { startRadius, endRadius };
  }

  /**
   * 두 점 사이의 거리 계산 (유클리드 거리)
   */
  private calculateDistance(
    point1: { x: number; y: number },
    point2: { x: number; y: number },
  ): number {
    const dx = point2.x - point1.x;
    const dy = point2.y - point1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * 그라데이션 색상 정지점 변환
   */
  private convertGradientStops(stops: any[]): (number | string)[] {
    const colorStops: (number | string)[] = [];

    for (const stop of stops) {
      const color = this.mapColor(stop.color);
      if (color) {
        colorStops.push(stop.position);
        colorStops.push(color);
      }
    }

    return colorStops;
  }
}

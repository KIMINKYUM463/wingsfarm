import type { KonvaFillConfig, KonvaStrokeConfig } from '../types/konva';
import { TextStyleMapper } from './TextStyleMapper';
import { FillMapper } from './FillMapper';
import { StrokeMapper } from './StrokeMapper';
import { LayoutMapper } from './LayoutMapper';

/**
 * 스타일 매핑을 담당하는 메인 조합기 클래스
 * 각 전문 매퍼들을 조합하여 전체 스타일 변환을 담당
 */
export class StyleMapper {
  private textStyleMapper: TextStyleMapper;
  private fillMapper: FillMapper;
  private strokeMapper: StrokeMapper;
  private layoutMapper: LayoutMapper;

  constructor() {
    this.textStyleMapper = new TextStyleMapper();
    this.fillMapper = new FillMapper();
    this.strokeMapper = new StrokeMapper();
    this.layoutMapper = new LayoutMapper();
  }

  // ==================== 텍스트 관련 메서드 ====================

  /**
   * 텍스트 정렬 매핑
   */
  mapTextAlign(align?: string): 'left' | 'center' | 'right' | 'justify' {
    return this.textStyleMapper.mapTextAlign(align);
  }

  /**
   * 수직 정렬 매핑
   */
  mapVerticalAlign(align?: string): 'top' | 'middle' | 'bottom' {
    return this.textStyleMapper.mapVerticalAlign(align);
  }

  /**
   * 폰트 스타일 매핑 (fontWeight + fontStyle)
   */
  mapFontStyle(
    fontWeight?: string | number,
    fontStyle?: string,
  ): 'normal' | 'bold' | 'italic' | 'bold italic' {
    return this.textStyleMapper.mapFontStyle(fontWeight, fontStyle);
  }

  /**
   * 줄 높이 매핑 (lineHeightPx를 fontSize로 나눈 비율)
   */
  mapLineHeight(lineHeightPx?: number, fontSize?: number): number {
    return this.textStyleMapper.mapLineHeight(lineHeightPx, fontSize);
  }

  /**
   * 텍스트 줄바꿈 매핑
   */
  mapWrap(textAutoResize?: string, text?: string): 'word' | 'char' | 'none' {
    return this.textStyleMapper.mapWrap(textAutoResize, text);
  }

  /**
   * 텍스트 말줄임 매핑
   */
  mapEllipsis(textTruncation?: string): boolean {
    return this.textStyleMapper.mapEllipsis(textTruncation);
  }

  // ==================== 채우기 관련 메서드 ====================

  /**
   * 단일 색상 매핑 (backgroundColor용)
   */
  mapColor(color?: { r: number; g: number; b: number; a: number }): string | null {
    return this.fillMapper.mapColor(color);
  }

  /**
   * 채우기 배열을 Konva fill 속성으로 변환
   */
  mapFills(
    fills?: any[],
    elementSize?: { width: number; height: number },
  ): KonvaFillConfig | undefined {
    return this.fillMapper.mapFills(fills, elementSize);
  }

  // ==================== 테두리 관련 메서드 ====================

  /**
   * Frame의 strokes 배열 매핑
   */
  mapStrokes(strokes?: any[]): KonvaStrokeConfig | undefined {
    return this.strokeMapper.mapStrokes(strokes);
  }

  // ==================== 레이아웃 관련 메서드 ====================

  /**
   * 모서리 둥글기 매핑
   */
  mapCornerRadius(cornerRadius?: number | number[]): number | number[] | undefined {
    return this.layoutMapper.mapCornerRadius(cornerRadius);
  }

  /**
   * 레이아웃 모드 매핑
   */
  mapLayoutMode(layoutMode?: string): string | undefined {
    return this.layoutMapper.mapLayoutMode(layoutMode);
  }

  /**
   * 패딩 매핑
   */
  mapPadding(
    paddingLeft?: number,
    paddingRight?: number,
    paddingTop?: number,
    paddingBottom?: number,
  ): { left: number; right: number; top: number; bottom: number } | undefined {
    return this.layoutMapper.mapPadding(paddingLeft, paddingRight, paddingTop, paddingBottom);
  }

  /**
   * 아이템 간격 매핑
   */
  mapItemSpacing(itemSpacing?: number): number | undefined {
    return this.layoutMapper.mapItemSpacing(itemSpacing);
  }

  // ==================== 공통 메서드 ====================

  /**
   * 투명도 매핑
   */
  mapOpacity(opacity?: number): number {
    return opacity !== undefined ? opacity : 1;
  }

  /**
   * 가시성 매핑
   */
  mapVisible(visible?: boolean): boolean {
    return visible !== undefined ? visible : true;
  }
}

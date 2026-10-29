/**
 * 레이아웃 매핑을 담당하는 클래스
 * Figma의 레이아웃 관련 속성을 Konva 레이아웃 속성으로 변환
 */
export class LayoutMapper {
  /**
   * 모서리 둥글기 매핑
   */
  mapCornerRadius(cornerRadius?: number | number[]): number | number[] | undefined {
    return cornerRadius;
  }

  /**
   * 레이아웃 모드 매핑
   */
  mapLayoutMode(layoutMode?: string): string | undefined {
    return layoutMode;
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
    if (
      paddingLeft === undefined &&
      paddingRight === undefined &&
      paddingTop === undefined &&
      paddingBottom === undefined
    ) {
      return undefined;
    }

    return {
      left: paddingLeft || 0,
      right: paddingRight || 0,
      top: paddingTop || 0,
      bottom: paddingBottom || 0,
    };
  }

  /**
   * 아이템 간격 매핑
   */
  mapItemSpacing(itemSpacing?: number): number | undefined {
    return itemSpacing;
  }
}

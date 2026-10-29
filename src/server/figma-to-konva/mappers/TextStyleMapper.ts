/**
 * 텍스트 스타일 매핑을 담당하는 클래스
 * Figma의 텍스트 관련 속성을 Konva 텍스트 속성으로 변환
 */
export class TextStyleMapper {
  /**
   * 텍스트 정렬 매핑
   */
  mapTextAlign(align?: string): 'left' | 'center' | 'right' | 'justify' {
    switch (align) {
      case 'LEFT':
        return 'left';
      case 'CENTER':
        return 'center';
      case 'RIGHT':
        return 'right';
      case 'JUSTIFIED':
        return 'justify';
      default:
        return 'left';
    }
  }

  /**
   * 수직 정렬 매핑
   */
  mapVerticalAlign(align?: string): 'top' | 'middle' | 'bottom' {
    switch (align) {
      case 'TOP':
        return 'top';
      case 'CENTER':
        return 'middle';
      case 'BOTTOM':
        return 'bottom';
      default:
        return 'top';
    }
  }

  /**
   * 폰트 스타일 매핑 (fontWeight + fontStyle)
   */
  mapFontStyle(
    fontWeight?: string | number,
    fontStyle?: string,
  ): 'normal' | 'bold' | 'italic' | 'bold italic' {
    const isBold =
      fontWeight === 'Bold' ||
      fontWeight === 'SemiBold' ||
      fontWeight === 700 ||
      fontWeight === '700' ||
      fontWeight === 600 ||
      fontWeight === '600';
    const isItalic = fontStyle === 'italic';

    if (isBold && isItalic) {
      return 'bold italic';
    } else if (isBold) {
      return 'bold';
    } else if (isItalic) {
      return 'italic';
    } else {
      return 'normal';
    }
  }

  /**
   * 줄 높이 매핑 (lineHeightPx를 fontSize로 나눈 비율)
   */
  mapLineHeight(lineHeightPx?: number, fontSize?: number): number {
    if (!lineHeightPx || !fontSize) {
      return 1.2; // 기본 줄 높이
    }
    return lineHeightPx / fontSize;
  }

  /**
   * 텍스트 줄바꿈 매핑
   * Figma의 textAutoResize를 Konva의 wrap으로 적절하게 변환
   */
  mapWrap(textAutoResize?: string, text?: string): 'word' | 'char' | 'none' {
    // const hasLineBreak = text && text.includes('\n');

    switch (textAutoResize) {
      // 텍스트 박스의 너비와 높이를 수동으로 고정합니다.
      case 'NONE':
      // Figma에서 수동으로 크기가 조절된 경우
      // 강제 줄바꿈(\n)이 있으면 Konva에서도 줄바꿈 처리
      // return 'none';

      // 텍스트 내용에 맞춰 박스의 너비와 높이가 모두 자동으로 조절됩니다.
      case 'WIDTH_AND_HEIGHT':

      // 텍스트 내용에 맞춰 높이만 자동으로 조절됩니다. 너비는 고정됩니다.
      case 'HEIGHT':
      // Figma에서 텍스트가 자동으로 줄바꿈되는 경우
      // 한글 텍스트의 특성(글자 단위 줄바꿈)을 고려하여 'char'를 리턴
      // return 'char';

      default:
        // textAutoResize 필드가 없는 경우 (\n 문자가 있다면 줄바꿈 처리)
        // if (hasLineBreak) {
        //   return 'char';
        // }
        return 'char';
    }
  }

  /**
   * 텍스트 말줄임 매핑
   */
  mapEllipsis(textTruncation?: string): boolean {
    return textTruncation === 'ENDING';
  }
}

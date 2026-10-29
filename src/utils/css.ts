/**
 * CSS 변수값을 픽셀 숫자로 변환하는 유틸 함수
 * @param varName CSS 변수 이름 (예: '--w-left-sidebar')
 * @returns 픽셀 단위의 숫자값
 *
 * @example
 * getCSSVariableValue('--w-left-sidebar') // 80 (5rem = 80px)
 * getCSSVariableValue('--tool-panel-w') // 370 (23.125rem = 370px)
 */
export const getCSSVariableValue = (varName: string): number => {
  if (typeof window === 'undefined') return 0;

  const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();

  // rem을 px로 변환 (1rem = 16px 기본값)
  if (value.endsWith('rem')) {
    return parseFloat(value) * 16;
  }

  // px 단위
  if (value.endsWith('px')) {
    return parseFloat(value);
  }

  // 단위 없는 숫자
  return parseFloat(value) || 0;
};

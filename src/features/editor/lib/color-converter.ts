/**
 * 색상 변환 유틸리티
 *
 * Konva.js fill 속성(rgba)과 HTML color picker(hex) 간 변환
 */

/**
 * rgba → hex 변환 (color picker용)
 * @example rgbaToHex('rgba(255, 255, 255, 1)') → '#FFFFFF'
 */
export const rgbaToHex = (rgba: string): string => {
  const match = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return rgba.startsWith('#') ? rgba : '#FFFFFF';

  const r = parseInt(match[1]).toString(16).padStart(2, '0');
  const g = parseInt(match[2]).toString(16).padStart(2, '0');
  const b = parseInt(match[3]).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`.toUpperCase();
};

/**
 * hex → rgba 변환 (Konva fill용)
 * @example hexToRgba('#FFFFFF') → 'rgba(255, 255, 255, 1)'
 */
export const hexToRgba = (hex: string): string => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return hex;

  const r = parseInt(result[1], 16);
  const g = parseInt(result[2], 16);
  const b = parseInt(result[3], 16);
  return `rgba(${r}, ${g}, ${b}, 1)`;
};


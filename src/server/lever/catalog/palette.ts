import { derivePalette, TONE_PRESETS } from '@/shared/lib/palette';
import type { DraftPalette as Palette, PalettePreset as PaletteInfo, PaletteRole } from '@/shared/types/draft';

export { derivePalette, normalizePalette, PALETTE_ROLES, TONE_PRESETS } from '@/shared/lib/palette';
export type { Palette, PaletteInfo, PaletteRole };

/** 카테고리별 기본 추천 톤 (사진 분석이 실패했을 때·"다른 조합 보기" 첫 화면) */
const CATEGORY_TONES: Record<string, string[]> = {
  agri: ['forest', 'coral', 'mocha', 'mint'],
  food: ['coral', 'mocha', 'forest', 'nude'],
  electronics: ['navy', 'ocean', 'mono', 'sky'],
  living: ['mint', 'nude', 'sky', 'mono'],
  fashion: ['mono', 'nude', 'navy', 'rose'],
  accessory: ['nude', 'mono', 'mocha', 'rose'],
  beauty: ['rose', 'lavender', 'nude', 'mint'],
  health: ['forest', 'ocean', 'mint', 'coral'],
  edu: ['ocean', 'navy', 'coral', 'mint'],
  clinic: ['lavender', 'sky', 'rose', 'mono'],
};

/** 카테고리에 어울리는 프리셋 4개 */
export function palettePresets(categoryId: string): PaletteInfo[] {
  const ids = CATEGORY_TONES[categoryId] ?? CATEGORY_TONES.living;
  return ids.map((id) => {
    const tone = TONE_PRESETS.find((t) => t.id === id)!;
    return { palette: derivePalette(tone.main), reason: `${tone.name} 톤 — 카테고리에 잘 어울리는 기본 조합` };
  });
}

import { derivePalette, suggestProductTones, TONE_PRESETS } from '@/shared/lib/palette';
import type { DraftPalette as Palette, PalettePreset as PaletteInfo, PaletteRole } from '@/shared/types/draft';

export {
  derivePalette,
  dominantToneFromTree,
  harmonizeTreeColors,
  nearestToneId,
  normalizePalette,
  PALETTE_ROLES,
  paletteFromToneId,
  parseCssColor,
  resolveProductToneId,
  suggestProductTones,
  tintNeutralBackgrounds,
  toneMatchScore,
  TONE_PRESETS,
  unifyTreePalette,
} from '@/shared/lib/palette';
export type { Palette, PaletteInfo, PaletteRole };

/** 상품·카테고리에 어울리는 프리셋 4개 */
export function palettePresets(categoryId: string, productName = ''): PaletteInfo[] {
  const ids = suggestProductTones(productName, categoryId).slice(0, 4);
  return ids.map((id) => {
    const tone = TONE_PRESETS.find((t) => t.id === id)!;
    return { palette: derivePalette(tone.main), reason: `${tone.name} 톤 — 이 상품 빛깔에 맞춰 골랐어요` };
  });
}

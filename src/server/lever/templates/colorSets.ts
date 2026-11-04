/**
 * 템플릿 색감 세트 — 구성(part2) 분류와 별도로, 페이지 전체 톤을 맞추기 위한 헬퍼
 *
 * builtin-ds / builtin-pt 는 id에 심은 스타일·스킨으로 톤을 알고,
 * Figma 템플릿은 프레임 강조색을 읽어 가까운 톤으로 묶는다.
 */
import { dominantToneFromTree, suggestProductTones, TONE_PRESETS } from '@/shared/lib/palette';
import { toneIdFromTemplateId } from '@/shared/lib/templateTone';
import type { FrameNode } from '../frames/tree';
import { readJson } from '../store';

export { toneIdFromTemplateId } from '@/shared/lib/templateTone';

const toneCache = new Map<string, string>();

export function toneLabel(toneId: string): string {
  return TONE_PRESETS.find((t) => t.id === toneId)?.name ?? toneId;
}

/** 상품에 맞는 페이지 색감 세트(톤) 하나 */
export function preferredPageTone(productName: string, categoryId: string | null | undefined): string {
  return suggestProductTones(productName, categoryId ?? '')[0] ?? 'forest';
}

/**
 * 템플릿의 색감 세트 id.
 * Figma는 프레임을 한 번 읽어 캐시한다 (초안 고르기에서 part2 후보만 호출).
 */
export async function resolveTemplateToneId(templateId: string, framePath: (id: string) => string): Promise<string> {
  const cached = toneCache.get(templateId);
  if (cached) return cached;

  const fromId = toneIdFromTemplateId(templateId);
  if (fromId) {
    toneCache.set(templateId, fromId);
    return fromId;
  }

  const frame = await readJson<FrameNode | null>(framePath(templateId), null);
  const tone = frame ? dominantToneFromTree(frame) : 'mono';
  toneCache.set(templateId, tone);
  return tone;
}

export function clearToneCache() {
  toneCache.clear();
}

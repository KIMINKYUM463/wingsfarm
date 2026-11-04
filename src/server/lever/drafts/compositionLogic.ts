/**
 * 구성 후보 순수 로직 (서버 전용 import 없음 — 단위 테스트 가능)
 */
import type { CompositionCandidate, DraftInput, DraftLength, DraftPalette } from '@/shared/types/draft';
import { isDesignStyleId, normalizeDesignStyle, type DesignStyleId } from '@/shared/lib/designStyles';
import { paletteFromToneId, resolveProductToneId, suggestProductTones, TONE_PRESETS } from '@/shared/lib/palette';
import { defaultFlow, ensureAgriClosing, findSectionType, fitLength, LENGTH_TARGET, withAiNotice } from '../catalog/sections';
import { dedupeExclusiveRoles, EXCLUSIVE_ROLE_GROUPS } from './compositionRoles';

export { dedupeExclusiveRoles, EXCLUSIVE_ROLE_GROUPS } from './compositionRoles';

/** 구성 후보 개수 */
export const COMPOSITION_CANDIDATE_COUNT = 5;

export const COMPOSITION_STRATEGIES = [
  { id: 'conversion', label: '짧고 전환 중심', hint: '핵심만 빠르게 설득하고 구매로 이끈다. 섹션 수를 짧게.' },
  { id: 'trust', label: '증거·신뢰 중심', hint: '후기·인증·실적·비교 등 근거 섹션을 앞에 둔다.' },
  { id: 'story', label: '스토리·장면 중심', hint: '산지·생산자·사용 장면·감성 스토리를 살린다.' },
  { id: 'detail', label: '정보·스펙 중심', hint: '상품 정보·규격·보관·사용법을 꼼꼼히 보여 준다.' },
  { id: 'premium', label: '선물·프리미엄', hint: '포장·선물·고급스러운 톤으로 가치를 올려 보여 준다.' },
] as const;

export type CompositionStrategyId = (typeof COMPOSITION_STRATEGIES)[number]['id'];

export const compositionSequenceKey = (ids: string[]) => ids.join('>');

export function paletteFromTone(toneId: string | undefined, fallbackMain = '#2F5D3A'): DraftPalette {
  return paletteFromToneId(toneId, fallbackMain);
}

/** 전략마다 서로 다른 색감 세트(톤) — 후보 5안이 초록/남색/빨강 세트로 갈라져 보이게 */
function tonesForStrategies(input: Pick<DraftInput, 'productName' | 'categoryId'>) {
  const home = suggestProductTones(input.productName, input.categoryId);
  const pad = ['forest', 'mocha', 'navy', 'coral', 'ocean', 'amber', 'mono', 'mint', 'wine', 'nude'];
  const pool = [...new Set([...home, ...pad])].filter((id) => TONE_PRESETS.some((t) => t.id === id));
  return {
    conversion: pool[0] ?? 'forest',
    trust: pool[1] ?? 'mocha',
    story: pool[2] ?? 'navy',
    detail: pool[3] ?? 'coral',
    premium: pool[4] ?? 'ocean',
  };
}

function toneSetTitle(toneId: string, strategyTitle: string) {
  const name = TONE_PRESETS.find((t) => t.id === toneId)?.name ?? toneId;
  return `${name} 세트 · ${strategyTitle}`.slice(0, 24);
}

export function styleForStrategy(strategy: string, preferred?: string): DesignStyleId {
  if (isDesignStyleId(preferred)) return preferred;
  if (strategy === 'trust') return 'docu';
  if (strategy === 'story') return 'natural';
  if (strategy === 'conversion') return 'pop';
  if (strategy === 'detail') return 'modern';
  if (strategy === 'premium') return 'premium';
  return 'modern';
}

/**
 * 농수산물·식품 상세페이지의 팔리는 세일즈 순서 (AIDA).
 * 전략(후기 강조, 스토리 강조)이 달라도 큰 단계는 지키게 한다.
 */
export const SALES_FUNNEL_STAGES: readonly (readonly string[])[] = [
  ['hero'],
  ['summary', 'concept'],
  ['review', 'certification', 'social_proof', 'facility'],
  [
    'quality',
    'comparison',
    'size_comparison',
    'point_sum',
    'detail',
    'season',
    'selection_process',
    'taste',
    'ingredients',
    'no_additive',
    'problem',
    'problem_cause',
    'solution',
    'modes',
  ],
  ['point_origin', 'point_origin_reason', 'point_producer', 'point_producer_reason', 'point_direct', 'development'],
  ['recipe', 'storage_washing', 'usage', 'how_to', 'recommend'],
  ['spec', 'options', 'package', 'set_line_up'],
  ['conversion', 'promotion'],
  ['shipping_method', 'delivery', 'season_delivery_schedule', 'season_banner'],
  ['faq', 'contact', 'data_notice', 'return_policy', 'product_notice', 'notice_ai'],
];

export function salesFunnelStage(id: string) {
  const index = SALES_FUNNEL_STAGES.findIndex((stage) => stage.includes(id));
  return index === -1 ? 3 : index;
}

/** 소개(summary/concept)와 구매 유도가 빠졌으면 세일즈 자리에 끼워 넣는다 */
export function ensureSalesAnchors(ids: string[], allowedIds: readonly string[]): string[] {
  const allow = new Set(allowedIds);
  const out = [...ids];
  if (allow.has('summary') && !out.includes('summary') && !out.includes('concept')) {
    const at = Math.max(out.indexOf('hero') + 1, 1);
    out.splice(at, 0, 'summary');
  } else if (allow.has('concept') && !out.includes('summary') && !out.includes('concept')) {
    const at = Math.max(out.indexOf('hero') + 1, 1);
    out.splice(at, 0, 'concept');
  }
  if (allow.has('conversion') && !out.includes('conversion')) {
    const closeAt = out.findIndex((id) => salesFunnelStage(id) >= 8);
    if (closeAt === -1) out.push('conversion');
    else out.splice(closeAt, 0, 'conversion');
  }
  return out;
}

/** 후보 목차를 세일즈 단계 순으로 맞춘다. 같은 단계 안에서는 원래 순서를 유지한다. */
export function orderBySalesFunnel(ids: string[]): string[] {
  return ids
    .map((id, index) => ({ id, index }))
    .sort((a, b) => {
      const stage = salesFunnelStage(a.id) - salesFunnelStage(b.id);
      return stage !== 0 ? stage : a.index - b.index;
    })
    .map((row) => row.id);
}

/** 사용자 길이의 최소 섹션 수에 못 미치면 기본 흐름으로 채운다 */
export function ensureLengthFloor(
  ids: string[],
  input: Pick<DraftInput, 'categoryId'>,
  length: DraftLength,
  allowedIds: readonly string[],
): string[] {
  const allow = new Set(allowedIds);
  const [min] = LENGTH_TARGET[length];
  if (ids.length >= min) return ids;
  const pad = defaultFlow(input.categoryId, length, (t) => allow.has(t.id));
  return [...new Set([...ids, ...pad])];
}

/**
 * 후보 목차 재검토(순수 로직): 역할 중복 제거 → 세일즈 순서 → 길이 맞춤 → 농수산 클로징
 */
export function reviewCompositionIds(
  rawIds: string[],
  input: Pick<DraftInput, 'categoryId' | 'imageMode' | 'length'>,
  allowedIds: readonly string[],
  length: DraftLength = input.length,
): string[] {
  return resolveCandidateSectionIds(rawIds, input, allowedIds, length);
}

export function resolveCandidateSectionIds(
  raw: unknown,
  input: Pick<DraftInput, 'categoryId' | 'imageMode' | 'length'>,
  allowedIds: readonly string[],
  length: DraftLength = input.length,
): string[] {
  const allow = new Set(allowedIds);
  const [, max] = LENGTH_TARGET[length];
  const list = Array.isArray(raw) ? raw.map(String) : [];
  let ids = dedupeExclusiveRoles([...new Set(list)].filter((id) => allow.has(id)));
  if (ids[0] !== 'hero' && allow.has('hero')) ids = ['hero', ...ids.filter((id) => id !== 'hero')];
  if (ids.length < 5) {
    const fallback = defaultFlow(input.categoryId, length, (t) => allow.has(t.id));
    ids = dedupeExclusiveRoles([...new Set([...ids, ...fallback])]);
    if (ids[0] !== 'hero' && allow.has('hero')) ids = ['hero', ...ids.filter((id) => id !== 'hero')];
  }
  ids = ensureLengthFloor(ids, input, length, allowedIds);
  ids = dedupeExclusiveRoles(ids);
  return withAiNotice(
    ensureAgriClosing(
      orderBySalesFunnel(fitLength(ensureSalesAnchors(ids, allowedIds), input.categoryId, max)),
      input.categoryId,
      allowedIds,
    ),
    input.imageMode === 'ai',
  );
}

function newCandidateId() {
  return `cand_${Math.random().toString(36).slice(2, 10)}`;
}

export function buildFallbackCompositionCandidates(
  input: Pick<DraftInput, 'categoryId' | 'imageMode' | 'length' | 'productName'>,
  allowedIds: readonly string[],
  excludeKeys: Set<string> = new Set(),
): CompositionCandidate[] {
  const allow = (t: { id: string }) => allowedIds.includes(t.id);
  const tones = tonesForStrategies(input);
  const builds: {
    strategy: CompositionStrategyId;
    length: DraftLength;
    title: string;
    reason: string;
    style: DesignStyleId;
    toneId: string;
    prefer?: string[];
  }[] = [
    // 길이는 사용자가 고른 input.length를 따르고, conversion만 한 단계 짧게(최소 short) 허용
    {
      strategy: 'conversion',
      length: input.length === 'extra' ? 'long' : input.length === 'long' ? 'short' : 'short',
      title: '짧게 설득',
      reason: '핵심만 빠르게 설득하고, 페이지 색감은 한 세트로 맞춰요',
      style: 'pop',
      toneId: tones.conversion,
    },
    {
      strategy: 'trust',
      length: input.length,
      title: '믿고 사는 구성',
      reason: '후기·인증 근거를 앞에 두고, 전체 색감을 통일해요',
      style: 'docu',
      toneId: tones.trust,
      prefer: ['hero', 'review', 'certification', 'social_proof', 'comparison'],
    },
    {
      strategy: 'story',
      length: input.length === 'short' ? 'long' : input.length,
      title: '이야기형 구성',
      reason: '산지·장면 스토리와 같은 색감 세트로 이어져요',
      style: 'natural',
      toneId: tones.story,
      prefer: ['hero', 'concept', 'point_origin', 'point_producer', 'usage', 'recipe'],
    },
    {
      strategy: 'detail',
      length: input.length === 'short' ? 'long' : input.length,
      title: '꼼꼼한 정보형',
      reason: '스펙·보관 정보를 한 가지 색감으로 정리해요',
      style: 'modern',
      toneId: tones.detail,
      prefer: ['hero', 'summary', 'spec', 'size_comparison', 'how_to', 'storage_washing', 'faq'],
    },
    {
      strategy: 'premium',
      length: input.length,
      title: '선물·프리미엄',
      reason: '고급스러운 한 가지 톤으로 가치 있게 보여 줘요',
      style: 'premium',
      toneId: tones.premium,
      prefer: ['hero', 'concept', 'package', 'quality', 'promotion', 'conversion'],
    },
  ];

  const out: CompositionCandidate[] = [];
  for (const b of builds) {
    let ids = resolveCandidateSectionIds(
      defaultFlow(input.categoryId, b.length, allow),
      input,
      allowedIds,
      b.length,
    );
    if (b.prefer?.length) {
      const preferred = b.prefer.filter((id) => allow({ id }));
      const inject = preferred.filter((id) => !ids.includes(id)).slice(0, 3);
      ids = resolveCandidateSectionIds([...ids, ...inject], input, allowedIds, b.length);
    }
    const key = compositionSequenceKey(ids);
    if (excludeKeys.has(key) && out.length >= COMPOSITION_CANDIDATE_COUNT - 1) continue;
    out.push({
      id: newCandidateId(),
      title: toneSetTitle(b.toneId, b.title),
      reason: b.reason,
      strategy: b.strategy,
      sectionTypeIds: ids,
      sectionNames: ids.map((id) => findSectionType(input.categoryId, id)?.name ?? id),
      designStyle: b.style,
      palette: paletteFromTone(b.toneId),
      lengthHint: b.length,
    });
    if (out.length >= COMPOSITION_CANDIDATE_COUNT) break;
  }

  while (out.length < COMPOSITION_CANDIDATE_COUNT) {
    const base =
      out[0] ??
      ({
        id: newCandidateId(),
        title: '기본 구성',
        reason: '카테고리 기본 흐름으로 만들어요',
        strategy: 'conversion',
        sectionTypeIds: withAiNotice(defaultFlow(input.categoryId, 'short', allow), input.imageMode === 'ai'),
        sectionNames: [] as string[],
        designStyle: 'modern' as DesignStyleId,
        palette: paletteFromTone('mono'),
        lengthHint: 'short' as DraftLength,
      } satisfies CompositionCandidate);
    out.push({
      ...base,
      id: newCandidateId(),
      title: `${base.title} · 변형 ${out.length + 1}`,
      sectionNames: base.sectionTypeIds.map((id) => findSectionType(input.categoryId, id)?.name ?? id),
    });
  }
  return out.slice(0, COMPOSITION_CANDIDATE_COUNT);
}

export function parseGeminiCandidates(
  rows: unknown[],
  input: DraftInput,
  allowedIds: readonly string[],
  excludeKeys: Set<string>,
  newId: () => string,
): CompositionCandidate[] {
  const out: CompositionCandidate[] = [];
  for (const row of rows) {
    const r = (row ?? {}) as Record<string, unknown>;
    const strategy = String(r.strategy ?? 'conversion');
    const lengthHint: DraftLength =
      r.lengthHint === 'extra' || r.lengthHint === 'long' || r.lengthHint === 'short' ? r.lengthHint : input.length;
    const ids = resolveCandidateSectionIds(r.sectionIds, input, allowedIds, lengthHint);
    const key = compositionSequenceKey(ids);
    if (excludeKeys.has(key) && out.length > 0) continue;
    if (out.some((c) => compositionSequenceKey(c.sectionTypeIds) === key)) continue;
    const toneId = resolveProductToneId(String(r.toneId ?? ''), input.productName, input.categoryId);
    const rawTitle = String(r.title ?? COMPOSITION_STRATEGIES.find((s) => s.id === strategy)?.label ?? '구성 제안');
    out.push({
      id: newId(),
      title: toneSetTitle(toneId, rawTitle.slice(0, 12)),
      reason: String(r.reason ?? '상품에 맞춰 구성을 골랐어요').slice(0, 80),
      strategy,
      sectionTypeIds: ids,
      sectionNames: ids.map((id) => findSectionType(input.categoryId, id)?.name ?? id),
      designStyle: normalizeDesignStyle(styleForStrategy(strategy, String(r.designStyle ?? ''))),
      palette: paletteFromTone(toneId),
      lengthHint,
    });
    if (out.length >= COMPOSITION_CANDIDATE_COUNT) break;
  }
  if (out.length < COMPOSITION_CANDIDATE_COUNT) {
    const keys = new Set([...excludeKeys, ...out.map((c) => compositionSequenceKey(c.sectionTypeIds))]);
    for (const fb of buildFallbackCompositionCandidates(input, allowedIds, keys)) {
      if (out.some((c) => compositionSequenceKey(c.sectionTypeIds) === compositionSequenceKey(fb.sectionTypeIds))) continue;
      out.push(fb);
      if (out.length >= COMPOSITION_CANDIDATE_COUNT) break;
    }
  }
  return out.slice(0, COMPOSITION_CANDIDATE_COUNT);
}

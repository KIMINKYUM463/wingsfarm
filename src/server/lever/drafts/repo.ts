import 'server-only';
import {
  DRAFT_LIMITS,
  emptyDraftInput,
  type CutRole,
  type DraftCut,
  type DraftEstimate,
  type DraftInput,
  type DraftItem,
  type DraftLine,
  type DraftPlan,
  type DraftRecord,
  type DraftSection,
  type DraftSummary,
  type SectionTypeInfo,
} from '@/shared/types/draft';
import { normalizeDesignStyle } from '@/shared/lib/designStyles';
import { effectiveHeroMotion, estimateCostUsd, isHeroMotion, normalizeCutSource } from '@/shared/lib/draftMedia';
import { sensoryLabel } from '@/shared/lib/draftFacts';
import { findCategory } from '../catalog/categories';
import { describeWarnings, findUnsupportedClaims } from '../catalog/factGuard';
import { normalizePalette, palettePresets } from '../catalog/palette';
import { EVIDENCE_LABELS, findSectionType, sectionTypesFor, type EvidenceKey, type SectionType } from '../catalog/sections';
import type { FrameNode } from '../frames/tree';
import { notFound } from '../http';
import { publicUrl, toStoragePath } from '../storage';
import { listFiles, newId, nowIso, readJson, removeData, updateJson, writeJson } from '../store';
import { buildSectionFrame } from '../templates/sectionLayouts';

const draftPath = (id: string) => `drafts/${id}.json`;

export async function getDraft(id: string) {
  const draft = await readJson<DraftRecord | null>(draftPath(id), null);
  if (!draft) throw notFound('초안을 찾을 수 없습니다.');
  // 이전 버전에서 만든 초안에는 새 입력 항목(사진 연출 등)이 없다
  return { ...draft, input: { ...emptyDraftInput(), ...draft.input } };
}

export const saveDraft = (draft: DraftRecord) => writeJson(draftPath(draft.id), draft);

export async function updateDraft(id: string, mutate: (draft: DraftRecord) => DraftRecord | Promise<DraftRecord>) {
  await getDraft(id);
  return updateJson<DraftRecord | null, DraftRecord>(
    draftPath(id),
    null,
    async (current) => ({ ...(await mutate(current!)), updatedAt: nowIso() }),
    (next) => next!,
  );
}

export const removeDraft = (id: string) => removeData(draftPath(id));

export async function listDraftRecords() {
  const files = (await listFiles('drafts')).filter((f) => f.endsWith('.json'));
  const drafts = await Promise.all(files.map((f) => readJson<DraftRecord | null>(`drafts/${f}`, null)));
  return drafts.filter((d): d is DraftRecord => Boolean(d)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function newDraftRecord(input: DraftInput): DraftRecord {
  const now = nowIso();
  return {
    id: newId(),
    status: 'editing',
    input,
    plan: null,
    progress: null,
    generateProgress: null,
    projectId: null,
    errorMessage: null,
    revision: 0,
    createdAt: now,
    updatedAt: now,
  };
}

// ===== 입력 정리 =====

const str = (value: unknown, max: number) => (typeof value === 'string' ? value.slice(0, max) : '');
const bool = (value: unknown) => value === true;

/** 업로드한 이미지 경로만 허용 (다른 저장소 파일을 AI에 보내지 않도록) */
const imagePaths = (value: unknown, max: number) =>
  Array.isArray(value)
    ? [...new Set(value.filter((v): v is string => typeof v === 'string').map(toStoragePath))]
        .filter((p) => p.startsWith('uploads/'))
        .slice(0, max)
    : [];

const pairs = <K extends string>(value: unknown, keys: [K, K], max: number, maxLen: number) =>
  Array.isArray(value)
    ? value
        .slice(0, max)
        .map((row) => Object.fromEntries(keys.map((k) => [k, str((row as Record<string, unknown>)?.[k], maxLen)])) as Record<K, string>)
    : [];

export function sanitizeInput(raw: unknown, base: DraftInput = emptyDraftInput()): DraftInput {
  const r = { ...base, ...(raw && typeof raw === 'object' ? (raw as Partial<DraftInput>) : {}) };
  const model = (r.model ?? {}) as Partial<DraftInput['model']>;
  const agri = (r.agri ?? {}) as Partial<DraftInput['agri']>;
  return {
    startMode: r.startMode === 'reuse' ? 'reuse' : 'new',
    reuseSourceProjectId: typeof r.reuseSourceProjectId === 'string' ? r.reuseSourceProjectId : null,
    productName: str(r.productName, DRAFT_LIMITS.productName),
    productImagePaths: imagePaths(r.productImagePaths, DRAFT_LIMITS.productImages),
    imageMode: r.imageMode === 'blank' ? 'blank' : 'ai',
    heroMotion: isHeroMotion(r.heroMotion) ? r.heroMotion : base.heroMotion,
    categoryId: findCategory(r.categoryId) ? String(r.categoryId) : '',
    features: str(r.features, DRAFT_LIMITS.features),
    sizeInfo: str(r.sizeInfo, DRAFT_LIMITS.sizeInfo),
    sensory: str(r.sensory, DRAFT_LIMITS.sensory),
    options: pairs(r.options, ['name', 'spec'], DRAFT_LIMITS.options, 100),
    model: {
      enabled: bool(model.enabled),
      description: str(model.description, DRAFT_LIMITS.modelDescription),
      imagePaths: imagePaths(model.imagePaths, 3),
    },
    length: r.length === 'long' ? 'long' : 'short',
    plan: str(r.plan, DRAFT_LIMITS.plan),
    reviewsText: str(r.reviewsText, DRAFT_LIMITS.reviewsText),
    reviewImagePaths: imagePaths(r.reviewImagePaths, 1),
    referenceMode: r.referenceMode === 'my_product' ? 'my_product' : 'reference',
    referenceImagePaths: imagePaths(r.referenceImagePaths, DRAFT_LIMITS.referenceImages),
    brandName: str(r.brandName, 50),
    agri: {
      origin: str(agri.origin, 300),
      harvest: str(agri.harvest, 300),
      selection: str(agri.selection, 500),
      producerStory: str(agri.producerStory, 1000),
      directShipping: bool(agri.directShipping),
    },
    certifications: pairs(r.certifications, ['name', 'number'], 10, 100),
    salesRecord: str(r.salesRecord, 500),
    promotion: str(r.promotion, 500),
    facility: str(r.facility, 1000),
    shipping: str(r.shipping, 500),
    contact: str(r.contact, 300),
  };
}

// ===== 근거 =====

const filled = (s: string) => s.trim().length > 0;

const GIFT_PATTERN = /명절|선물|추석|설날|한가위|답례|기프트|gift/i;

/** 판매자가 명절·선물용으로 팔 계획을 적었는지 */
const mentionsGift = (input: DraftInput) =>
  GIFT_PATTERN.test([input.productName, input.features, input.plan, input.promotion, ...input.options.map((o) => o.name)].join(' '));

export function evidenceKeys(input: DraftInput, reviewQuotes: string[] = []) {
  const keys = new Set<EvidenceKey>();
  const add = (key: EvidenceKey, on: boolean) => on && keys.add(key);
  add('reviews', filled(input.reviewsText) || input.reviewImagePaths.length > 0 || reviewQuotes.length > 0);
  add('certifications', input.certifications.some((c) => filled(c.name)));
  add('salesRecord', filled(input.salesRecord));
  add('producer', filled(input.agri.producerStory));
  add('origin', filled(input.agri.origin));
  add('harvest', filled(input.agri.harvest));
  add('selection', filled(input.agri.selection));
  add('directShipping', input.agri.directShipping);
  add('options', input.options.some((o) => filled(o.name)));
  add('size', filled(input.sizeInfo) || input.options.some((o) => filled(o.spec)));
  add('promotion', filled(input.promotion));
  add('facility', filled(input.facility));
  add('model', input.model.enabled && (filled(input.model.description) || input.model.imagePaths.length > 0));
  add('gift', mentionsGift(input));
  return keys;
}

export const lockedReason = (type: SectionType, keys: Set<EvidenceKey>) =>
  type.evidence && !keys.has(type.evidence) ? `${EVIDENCE_LABELS[type.evidence]}를 입력하면 추가할 수 있어요` : null;

export function sectionTypeInfos(input: DraftInput, reviewQuotes: string[] = []): SectionTypeInfo[] {
  const keys = evidenceKeys(input, reviewQuotes);
  return sectionTypesFor(input.categoryId).map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    group: t.group,
    layout: t.layout,
    cuts: t.cuts,
    modelCapable: Boolean(t.modelCapable),
    lockedReason: lockedReason(t, keys),
  }));
}

/**
 * 근거 자료 목록 — AI에게 [id] 형식으로 주고, 문장마다 이 id를 근거로 달게 한다.
 * 사실 검사는 이 목록(사용자가 직접 입력한 내용 + 후기 원문)만 근거로 인정한다.
 */
export function evidenceEntries(input: DraftInput, reviewQuotes: string[] = []) {
  const entries: { id: string; text: string }[] = [];
  const add = (id: string, label: string, value: string) => filled(value) && entries.push({ id, text: `${label}: ${value.trim()}` });
  add('product:name', '상품명', input.productName);
  add('product:category', '카테고리', findCategory(input.categoryId)?.name ?? '');
  add('brand', '브랜드', input.brandName);
  input.features
    .split('\n')
    .map((line) => line.replace(/^\s*(?:\d+[.)]|[-*•])\s*/, '').trim())
    .filter(Boolean)
    .forEach((line, i) => add(`feature:${i + 1}`, '특징', line));
  add('size', '크기·중량', input.sizeInfo);
  add('sensory', sensoryLabel(input.categoryId), input.sensory);
  input.options.forEach((o, i) => add(`option:${i + 1}`, '옵션', [o.name, o.spec].filter(filled).join(' ')));
  add('agri:origin', '산지', input.agri.origin);
  add('agri:harvest', '수확·제철', input.agri.harvest);
  add('agri:selection', '선별 기준', input.agri.selection);
  add('agri:producer', '생산자 이야기', input.agri.producerStory);
  if (input.agri.directShipping) add('agri:direct', '배송', '산지직송');
  input.certifications.forEach((c, i) => add(`certification:${i + 1}`, '인증', [c.name, c.number && `(번호 ${c.number})`].filter(Boolean).join(' ')));
  add('sales', '판매 실적', input.salesRecord);
  add('promotion', '이벤트·혜택', input.promotion);
  add('facility', '시설·공정', input.facility);
  add('shipping', '배송 정보', input.shipping);
  add('contact', '고객센터', input.contact);
  add('plan', '판매자 기획안', input.plan);
  const reviews = [...input.reviewsText.split('\n'), ...reviewQuotes].map((r) => r.trim()).filter(Boolean).slice(0, 30);
  reviews.forEach((r, i) => add(`review:${i + 1}`, '실제 후기', r));
  return entries;
}

export const evidenceText = (input: DraftInput, reviewQuotes: string[] = []) =>
  evidenceEntries(input, reviewQuotes)
    .map((e) => e.text)
    .join('\n');

// ===== 기획 정리 =====

const ROLES: CutRole[] = ['hero', 'proof', 'comparison', 'benefit', 'detail'];

const line = (value: unknown, max = 300): DraftLine | null => {
  const v = value as Partial<DraftLine> | string | null | undefined;
  const text = (typeof v === 'string' ? v : typeof v?.text === 'string' ? v.text : '').trim().slice(0, max);
  if (!text) return null;
  const evidence = typeof v === 'object' && Array.isArray(v?.evidence) ? v.evidence.filter((e): e is string => typeof e === 'string').slice(0, 6) : [];
  return { text, evidence };
};

export function sanitizeCut(raw: unknown, photoCount: number, itemCount: number): DraftCut {
  const c = (raw ?? {}) as Partial<DraftCut>;
  const indexes = Array.isArray(c.photoIndexes)
    ? [...new Set(c.photoIndexes.map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n < photoCount))].slice(0, 3)
    : [];
  const itemIndex = Number.isInteger(c.itemIndex) && Number(c.itemIndex) >= 0 && Number(c.itemIndex) < itemCount ? Number(c.itemIndex) : null;
  return {
    id: typeof c.id === 'string' && c.id ? c.id.slice(0, 64) : newId(),
    scene: str(c.scene, 60).trim() || '상품 컷',
    plan: str(c.plan, 500).trim(),
    role: ROLES.includes(c.role as CutRole) ? (c.role as CutRole) : 'detail',
    source: normalizeCutSource(c.source, photoCount),
    photoIndexes: indexes.length || !photoCount ? indexes : [0],
    modelAllowed: bool(c.modelAllowed),
    itemIndex,
  };
}

/** 섹션 하나를 검증하고 사실 검사 경고를 다시 계산한다 */
export function sanitizeSection(raw: unknown, input: DraftInput, evidence: string): DraftSection | null {
  const s = (raw ?? {}) as Partial<DraftSection>;
  const type = typeof s.typeId === 'string' ? findSectionType(input.categoryId, s.typeId) : undefined;
  if (!type) return null;
  const items: DraftItem[] = (Array.isArray(s.items) ? s.items : [])
    .slice(0, 12)
    .map((item) => ({ title: line(item?.title, 120), text: line(item?.text, 600) }))
    .filter((item): item is DraftItem => item.text !== null);
  const photoCount = input.productImagePaths.length;
  const cuts = type.cuts === 'none' ? [] : (Array.isArray(s.cuts) ? s.cuts : []).slice(0, 8).map((c) => sanitizeCut(c, photoCount, items.length));
  const section: DraftSection = {
    id: typeof s.id === 'string' && s.id ? s.id.slice(0, 64) : newId(),
    typeId: type.id,
    label: line(s.label, 60),
    title: line(s.title, DRAFT_LIMITS.sectionTitle) ?? { text: type.name, evidence: [] },
    subtitle: line(s.subtitle, 300),
    items,
    cuts,
    referenceImagePath: imagePaths(s.referenceImagePath ? [s.referenceImagePath] : [], 1)[0] ?? null,
    warnings: [],
  };
  section.warnings = factWarnings(section, evidence);
  return section;
}

export function factWarnings(section: DraftSection, evidence: string) {
  const lines = [section.label, section.title, section.subtitle, ...section.items.flatMap((i) => [i.title, i.text])];
  const warnings = lines.flatMap((l) => (l ? findUnsupportedClaims(l.text, evidence) : []));
  return [...new Set(describeWarnings(warnings))];
}

export function sanitizePlan(raw: unknown, input: DraftInput, previous: DraftPlan | null): DraftPlan {
  const p = (raw ?? {}) as Partial<DraftPlan>;
  const reviewQuotes = previous?.analysis?.reviewQuotes ?? [];
  const evidence = evidenceText(input, reviewQuotes);
  const fallback = previous?.palette ?? palettePresets(input.categoryId)[0].palette;
  return {
    sections: (Array.isArray(p.sections) ? p.sections : [])
      .slice(0, 40)
      .map((s) => sanitizeSection(s, input, evidence))
      .filter((s): s is DraftSection => s !== null),
    palette: normalizePalette(p.palette, fallback),
    paletteReason: str(p.paletteReason, 200) || previous?.paletteReason || '',
    designStyle: normalizeDesignStyle(p.designStyle, previous?.designStyle),
    analysis: previous?.analysis ?? null,
  };
}

// ===== 미리보기·예상치 =====

export function sectionFrames(plan: DraftPlan, categoryId: string) {
  const frames: { section: DraftSection; type: SectionType; frame: FrameNode }[] = [];
  for (const section of plan.sections) {
    const type = findSectionType(categoryId, section.typeId);
    if (type) frames.push({ section, type, frame: buildSectionFrame(section, type, plan.palette, plan.designStyle) });
  }
  return frames;
}

const collectCutIds = (frame: FrameNode) => (frame.children ?? []).map((n) => n.cutId).filter((id): id is string => typeof id === 'string');

/** 페이지 맨 위(가장 먼저 나오는) 사진 자리의 컷 — 움직이는 컷의 원본 */
export function heroCutOf(frames: ReturnType<typeof sectionFrames>) {
  for (const { section, frame } of frames) {
    const cutId = collectCutIds(frame)[0];
    if (cutId) return section.cuts.find((c) => c.id === cutId) ?? null;
  }
  return null;
}

export function estimatePlan(plan: DraftPlan | null, input: DraftInput): DraftEstimate {
  if (!plan) return { sectionCount: 0, heightPx: 0, aiCutCount: 0, ownCutCount: 0, blankCutCount: 0, heroMotion: 'off', costUsd: 0 };
  const frames = sectionFrames(plan, input.categoryId);
  const cutIds = new Set(frames.flatMap(({ frame }) => collectCutIds(frame)));
  const usedCuts = plan.sections.flatMap((s) => s.cuts).filter((c) => cutIds.has(c.id));
  const count = (source: DraftCut['source']) => usedCuts.filter((c) => c.source === source).length;
  const heroMotion = effectiveHeroMotion(input.heroMotion, heroCutOf(frames)?.source ?? null);
  return {
    sectionCount: plan.sections.length,
    heightPx: frames.reduce((sum, { frame }) => sum + Number(frame.height ?? 0), 0),
    aiCutCount: count('ai'),
    ownCutCount: count('own'),
    blankCutCount: count('blank'),
    heroMotion,
    costUsd: estimateCostUsd(count('ai'), heroMotion),
  };
}

// ===== 응답 =====

export function toDraftDto(draft: DraftRecord) {
  const previews = draft.plan
    ? Object.fromEntries(sectionFrames(draft.plan, draft.input.categoryId).map(({ section, frame }) => [section.id, frame]))
    : {};
  return {
    ...draft,
    imageUrls: Object.fromEntries(allImagePaths(draft).map((p) => [p, publicUrl(p)])),
    previews,
    estimate: estimatePlan(draft.plan, draft.input),
    sectionTypes: draft.input.categoryId ? sectionTypeInfos(draft.input, draft.plan?.analysis?.reviewQuotes) : [],
  };
}

const allImagePaths = (d: DraftRecord) => [
  ...d.input.productImagePaths,
  ...d.input.model.imagePaths,
  ...d.input.reviewImagePaths,
  ...d.input.referenceImagePaths,
  ...(d.plan?.sections.map((s) => s.referenceImagePath).filter((p): p is string => Boolean(p)) ?? []),
];

export const toDraftSummary = (d: DraftRecord): DraftSummary => ({
  id: d.id,
  productName: d.input.productName,
  categoryId: d.input.categoryId,
  status: d.status,
  thumbnailUrl: d.input.productImagePaths[0] ? publicUrl(d.input.productImagePaths[0]) : null,
  sectionCount: d.plan?.sections.length ?? 0,
  updatedAt: d.updatedAt,
});

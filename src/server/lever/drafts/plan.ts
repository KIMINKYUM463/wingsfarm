import 'server-only';
import pLimit from 'p-limit';
import { defaultCutSource, sceneIdeas } from '@/shared/lib/draftMedia';
import type { DraftAnalysis, DraftInput, DraftPlan, DraftProgress, DraftRecord, DraftSection, PhotoAnalysis } from '@/shared/types/draft';
import { CATEGORIES, findCategory } from '../catalog/categories';
import { NATURAL_COPY_RULES } from '../copyStyle';
import { derivePalette, normalizePalette, palettePresets, TONE_PRESETS } from '../catalog/palette';
import { defaultFlow, findSectionType, fitLength, LENGTH_TARGET, suggestableTypes, withAiNotice, type SectionType } from '../catalog/sections';
import {
  allocatableFacts,
  defaultOwners,
  FACT_FREE_SECTIONS,
  factKeywords,
  findRepeats,
  normalizeOwners,
  pruneOutline,
  type FactEntry,
  type FactOwners,
} from './factPlan';
import { loadInlineImages, requireGemini, type GeminiClient } from '../gemini';
import { ApiError, badRequest } from '../http';
import { getProject } from '../projects';
import { newId } from '../store';
import { expectedCutCount } from '../templates/sectionLayouts';
import {
  evidenceEntries,
  evidenceKeys,
  evidenceText,
  getDraft,
  lockedReason,
  sanitizeCut,
  sanitizeSection,
  updateDraft,
} from './repo';

const COPY_RULES = `규칙:
- 근거 자료에 있는 사실만 쓴다. 수치·소재·원산지·인증·효능·가격·순위·후기·산지직송 여부는 자료에 없으면 절대 쓰지 않는다.
- 문장마다 evidence에 근거 id를 단다(예: ["feature:2"]). 사진에서 본 사실은 "photo:번호", 감성 표현처럼 사실 주장이 없는 문장은 ["general"].
- 판매자가 채워야 하는 정보(배송일·연락처 등)가 자료에 없으면 "[입력 필요]"라고 쓴다.
- 다른 상품을 깎아내리지 않는다. 의학적 효능을 단정하지 않는다.
- 메인 문구는 짧고 구체적으로(공백 포함 22자 이내, 필요하면 \\n으로 두 줄). 픽셀·글꼴은 지정하지 않는다.

${NATURAL_COPY_RULES}`;

const IMAGE_PLAN_RULES = `컷(사진) 계획 규칙:
- scene: 짧은 장면 이름(15자 이내). plan: 배경·구도·조명·소품을 구체적으로 한두 문장(한국어).
- 상품 외형·색·포장·수량은 사진 그대로. 내부 구조·제조 시설·사용 전후 효과는 지어내지 않는다. 광고 문구는 컷이 아니라 카피에 쓴다.
- photoIndexes: 참고할 상품 사진 번호(0부터). role: hero/proof/comparison/benefit/detail 중 하나.
- 장면은 섹션마다 달라야 한다. 같은 각도·같은 배경의 반복 컷 금지. 배경·소품·거리(전경/중경/클로즈업)·시간대를 바꿔 다양하게.
- 장면이 달라도 상품의 색·모양·크기·수량·포장은 사진과 똑같이 유지한다(과장 연출 금지).
- 실제 증거가 되는 컷(proof)은 올린 사진을 그대로 쓰는 편이 좋다.`;

// ===== 진행 표시 =====

const setProgress = (id: string, progress: Partial<DraftProgress>) =>
  updateDraft(id, (d) => ({
    ...d,
    progress: { step: 'photos', message: '', current: 0, total: 0, outline: [], ...d.progress, ...progress },
  }));

// ===== 1. 사진·색 분석 =====

interface AnalysisResponse {
  identity?: Partial<DraftAnalysis['identity']>;
  photos?: Partial<PhotoAnalysis>[];
  confirmedFacts?: string[];
  coverageNotes?: string[];
  palette?: { main?: string; point?: string; bgLight?: string; bgDark?: string };
  paletteReason?: string;
}

const strings = (value: unknown, max = 12) => (Array.isArray(value) ? value.map(String).filter(Boolean).slice(0, max) : []);

async function analyzeProduct(gemini: GeminiClient, input: DraftInput, evidence: string) {
  const photos = await loadInlineImages(input.productImagePaths, 10);
  const references = input.referenceMode === 'reference' ? await loadInlineImages(input.referenceImagePaths, 4) : [];
  const result = await gemini.generateJson<AnalysisResponse>(
    `너는 한국 이커머스 상세페이지 기획자다. 첨부 사진 앞쪽 ${photos.length}장은 판매자가 올린 상품 사진(0번부터)이고${references.length ? `, 뒤쪽 ${references.length}장은 참고 디자인(색감·분위기 참고용)` : ''}이다.

[판매자 입력]
${evidence}

다음을 JSON으로 답하라.
{"identity":{"scale":"크기감","usage":"용도","material":"재질","structure":"구조","colorFinish":"색·마감"},
 "photos":[{"index":0,"label":"사진 설명 10자 내외","usable":true,"hasPerson":false,"note":"손·배경 등 복제하면 안 되는 요소"}],
 "confirmedFacts":["사진·입력으로 확인되는 사실"],
 "coverageNotes":["상세페이지에 부족한 사진 종류 안내(예: 사용 장면 사진이 없어요)"],
 "palette":{"main":"#RRGGBB","point":"#RRGGBB","bgLight":"#RRGGBB","bgDark":"#RRGGBB"},
 "paletteReason":"이 색을 고른 이유 한 문장(30자 내외, ~했어요 체)"}

색 규칙: main은 버튼·배지에 쓰는 진한 색(흰 글씨가 잘 보이게), point는 main보다 한 단계 연하게, bgLight는 흰색에 가까운 바탕, bgDark는 bgLight보다 조금 짙은 바탕. 상품 사진${references.length ? '과 참고 디자인' : ''}의 색감에서 고른다.
사진·입력으로 확인할 수 없는 내용은 쓰지 않는다.`,
    [...photos, ...references],
  );
  const id = result.identity ?? {};
  const analysis: DraftAnalysis = {
    identity: {
      scale: String(id.scale ?? ''),
      usage: String(id.usage ?? ''),
      material: String(id.material ?? ''),
      structure: String(id.structure ?? ''),
      colorFinish: String(id.colorFinish ?? ''),
    },
    photos: (result.photos ?? [])
      .filter((p) => Number.isInteger(p.index) && Number(p.index) < photos.length)
      .map((p) => ({ index: Number(p.index), label: String(p.label ?? ''), usable: p.usable !== false, hasPerson: p.hasPerson === true, note: String(p.note ?? '') })),
    confirmedFacts: strings(result.confirmedFacts),
    coverageNotes: strings(result.coverageNotes, 5),
    reviewQuotes: [],
  };
  const fallback = palettePresets(input.categoryId)[0];
  return {
    analysis,
    palette: normalizePalette(result.palette, fallback.palette),
    paletteReason: String(result.paletteReason ?? '').slice(0, 120) || fallback.reason,
  };
}

/** 리뷰 스크린샷 → 실제 후기 문장 (옮겨 적기만, 지어내기 금지) */
async function transcribeReviews(gemini: GeminiClient, paths: string[]) {
  const images = await loadInlineImages(paths, 1);
  if (!images.length) return [];
  const result = await gemini.generateJson<{ reviews?: string[] }>(
    '첨부한 리뷰 스크린샷에 보이는 고객 후기 문장을 그대로 옮겨 적어라. 고치거나 지어내지 말고, 개인정보(이름·아이디)는 빼라. JSON: {"reviews":["후기1","후기2"]}',
    images,
  );
  return strings(result.reviews, 20).map((r) => r.slice(0, 300));
}

// ===== 2. 섹션 구성 =====

/** 섹션 순서 + 섹션마다 맡은 상품 사실 */
interface Outline {
  ids: string[];
  owners: FactOwners;
}

/** 이보다 적게 남으면 AI 구성을 버리고 기본 흐름을 쓴다 */
const MIN_OUTLINE = 5;

/** AI가 빠뜨린 사실은 기본 배분으로 채우고, 맡을 사실이 없는 섹션은 뺀다 */
function settleOutline(ids: string[], owners: FactOwners, facts: FactEntry[], categoryId: string, max: number): Outline {
  const taken = new Set(Object.values(owners).flat());
  const extra = defaultOwners(ids, facts.filter((f) => !taken.has(f.id)));
  const merged = Object.fromEntries(ids.map((id) => [id, [...(owners[id] ?? []), ...(extra[id] ?? [])]]));
  const kept = fitLength(pruneOutline(ids, merged), categoryId, max);
  return { ids: kept, owners: Object.fromEntries(kept.map((id) => [id, merged[id]])) };
}

async function planOutline(gemini: GeminiClient, input: DraftInput, available: SectionType[], fallback: string[], facts: FactEntry[]): Promise<Outline> {
  const [, max] = LENGTH_TARGET[input.length];
  const fallbackOutline = () => settleOutline(fallback, {}, facts, input.categoryId, max);
  const factFree = available.filter((t) => FACT_FREE_SECTIONS.has(t.id)).map((t) => t.id);
  try {
    const result = await gemini.generateJson<{ sections?: unknown[] }>(
      `너는 한국 이커머스 상세페이지 기획자다. 상품에 맞는 섹션 순서를 정하고, 섹션마다 중심으로 다룰 상품 사실을 나눠 맡겨라.

[상품] ${input.productName} (${findCategory(input.categoryId)?.name})
[판매자 기획안] ${input.plan.trim() || '없음'}
[상품 사실] (id: 내용)
${facts.map((f) => `${f.id}: ${f.text}`.slice(0, 300)).join('\n') || '없음'}
[쓸 수 있는 섹션] (id: 이름 — 역할)
${available.map((t) => `${t.id}: ${t.name} — ${t.description}`).join('\n')}
[참고 기본 흐름] ${fallback.join(' → ')}

규칙:
- 첫 섹션은 hero. 같은 id는 한 번만. 최대 ${max}개. 판매자 기획안이 있으면 그 흐름을 우선한다.
- 사실 하나는 한 섹션에만 맡긴다. 섹션마다 facts에 맡은 사실 id를 단다.
- 맡을 사실이 없는 섹션은 넣지 않는다. 단 다음 섹션은 사실 없이도 된다: ${factFree.join(', ')}.
- 사실이 적으면 섹션 수를 줄인다. 같은 사실을 여러 섹션으로 나눠 늘리지 않는다(예: 산지 하나로 산지 섹션 두 개 X).
JSON: {"sections":[{"id":"hero","facts":[]},{"id":"quality","facts":["feature:1","feature:3"]}]}`,
    );
    const rows = (Array.isArray(result.sections) ? result.sections : []).map((row) =>
      typeof row === 'string' ? { id: row, facts: [] } : { id: String((row as { id?: unknown })?.id ?? ''), facts: (row as { facts?: unknown })?.facts },
    );
    const ids = [...new Set(rows.map((r) => r.id))].filter((id) => available.some((t) => t.id === id));
    const ordered = ids[0] === 'hero' || !available.some((t) => t.id === 'hero') ? ids : ['hero', ...ids.filter((id) => id !== 'hero')];
    const owners = normalizeOwners(ordered, Object.fromEntries(rows.map((r) => [r.id, r.facts])), facts);
    const outline = settleOutline(ordered, owners, facts, input.categoryId, max);
    return outline.ids.length >= MIN_OUTLINE ? outline : fallbackOutline();
  } catch {
    return fallbackOutline();
  }
}

// ===== 3. 섹션 카피 + 컷 계획 =====

interface SectionContext {
  input: DraftInput;
  analysis: DraftAnalysis | null;
  entries: string;
  evidence: string;
}

function sectionContext(input: DraftInput, analysis: DraftAnalysis | null): SectionContext {
  const quotes = analysis?.reviewQuotes ?? [];
  return {
    input,
    analysis,
    entries: evidenceEntries(input, quotes)
      .map((e) => `${e.id}: ${e.text}`.slice(0, 600))
      .join('\n'),
    evidence: evidenceText(input, quotes),
  };
}

function photoList(ctx: SectionContext) {
  const photos = ctx.analysis?.photos ?? [];
  return ctx.input.productImagePaths
    .map((_, i) => {
      const p = photos.find((photo) => photo.index === i);
      return `${i}: ${p ? `${p.label}${p.hasPerson ? ' (인물 있음)' : ''}${p.usable ? '' : ' (사용 어려움)'}` : '상품 사진'}`;
    })
    .join('\n');
}

/** 섹션 위치마다 다른 장면 후보를 줘서 페이지 전체 장면이 겹치지 않게 한다 */
const sceneHint = (ctx: SectionContext, position: number) => {
  const ideas = sceneIdeas(ctx.input.categoryId);
  return `이번 섹션 컷 장면 후보(다른 섹션과 겹치지 않게 이 방향 우선): ${ideas[position % ideas.length]}, ${ideas[(position + 3) % ideas.length]}`;
};

const sectionName = (categoryId: string, id: string) => findSectionType(categoryId, id)?.name ?? id;

/** 이 섹션이 맡은 사실·다른 섹션이 맡은 사실·항목 수 규칙 */
function focusRules(ctx: SectionContext, type: SectionType, outline: Outline, avoid: string[]) {
  const owned = outline.owners[type.id] ?? [];
  const others = outline.ids
    .filter((id) => id !== type.id)
    .flatMap((id) => (outline.owners[id] ?? []).map((fact) => `${fact} → ${sectionName(ctx.input.categoryId, id)}`));
  const [minItems, maxItems] = type.items;
  const flexible = !FACT_FREE_SECTIONS.has(type.id);
  return [
    type.id === 'hero'
      ? '[첫 화면] 페이지에서 가장 강한 사실 2~3개를 짧은 키워드로만 쓴다. 자세한 설명은 뒤 섹션이 한다.'
      : owned.length
        ? `[이 섹션이 맡은 사실] ${owned.join(', ')} — 이 사실을 중심으로, 손님이 장면을 떠올릴 만큼 구체적으로 쓴다.`
        : '[이 섹션이 맡은 사실] 없음 — 사진에서 보이는 것과 일반 정보(먹는 법·보관·고객이 실제로 궁금한 점)로 쓰고, 상품 사실은 꼭 필요할 때 한 번 짧게만.',
    others.length && type.id !== 'hero' ? `[다른 섹션이 맡은 사실] ${others.join(', ')} — 이 섹션에서 다시 설명하지 않는다.` : '',
    flexible
      ? `항목 수: 1~${maxItems}개 — 맡은 사실로 채울 수 있는 만큼만. 사실 하나를 말만 바꿔 여러 항목으로 나누지 않는다.`
      : `항목 수: ${minItems}~${maxItems}개`,
    '항목은 제목·설명 문구를 되풀이하지 않고 새 정보를 하나씩 더한다. "사진으로 확인하세요", "~을 기준으로 삼아요"처럼 정보 없는 문장은 쓰지 않는다.',
    type.layout === 'faq'
      ? 'FAQ는 본문에서 이미 설명한 사실을 다시 묻고 답하지 않는다. 구매 전에 실제로 묻는 것(받는 날·보관 기간·크기·교환)을 쓰고, 자료로 답할 수 없는 질문은 넣지 않는다.'
      : '',
    avoid.length ? `[고쳐 쓸 점] 이전 초안에 이런 반복이 있었다: ${avoid.join(' / ')}. 이 말은 빼고 이 섹션만의 정보로 다시 쓴다.` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

async function writeSection(
  gemini: GeminiClient,
  ctx: SectionContext,
  type: SectionType,
  neighbors: string,
  position: number,
  outline: Outline,
  avoid: string[] = [],
): Promise<DraftSection> {
  const cutRule =
    type.cuts === 'none'
      ? '이 섹션은 사진 컷이 없다. cuts는 빈 배열.'
      : type.cuts === 'one'
        ? '사진 컷 1개 (itemIndex는 null).'
        : `항목마다 컷 1개 (itemIndex는 항목 번호 0부터).`;
  const modelRule =
    ctx.input.model.enabled && type.modelCapable
      ? `인물 연출 가능: 판매자가 원하는 모델 — ${ctx.input.model.description || '사진 참고'}. 인물이 상품 매력을 높이는 컷만 modelAllowed=true.`
      : '인물 없이 연출한다(modelAllowed=false).';
  const result = await gemini.generateJson<Record<string, unknown>>(
    `너는 한국 이커머스 상세페이지 카피라이터 겸 연출 기획자다.

[근거 자료] (id: 내용)
${ctx.entries}

[상품 사진] (번호: 설명)
${photoList(ctx) || '없음'}
${ctx.analysis ? `[사진 분석] 크기감 ${ctx.analysis.identity.scale} / 용도 ${ctx.analysis.identity.usage} / 재질 ${ctx.analysis.identity.material} / 색 ${ctx.analysis.identity.colorFinish}` : ''}

[이번 섹션] ${type.name} (${type.id}) — ${type.description}
작성 가이드: ${type.guide}
${focusRules(ctx, type, outline, avoid)}
${cutRule}
${type.cuts === 'none' ? '' : sceneHint(ctx, position)}
${modelRule}
[페이지 흐름] ${neighbors}

${COPY_RULES}
${IMAGE_PLAN_RULES}

JSON 형식:
{"label":{"text":"영문 또는 짧은 라벨","evidence":["general"]} 또는 null,
 "title":{"text":"메인 문구","evidence":["..."]},
 "subtitle":{"text":"설명 문구","evidence":["..."]} 또는 null,
 "items":[{"title":{"text":"항목 제목","evidence":["..."]} 또는 null,"text":{"text":"항목 내용","evidence":["..."]}}],
 "cuts":[{"scene":"장면 이름","plan":"촬영 지시문","role":"hero","photoIndexes":[0],"itemIndex":null,"modelAllowed":false}]}`,
    [],
    'copy',
  );
  return finalizeSection(result, type, ctx, position);
}

/** AI 결과를 정리: 항목·컷 수를 섹션 종류에 맞추고 기본 컷 출처(AI/내 사진/빈 자리)를 정한다 */
function finalizeSection(raw: Record<string, unknown>, type: SectionType, ctx: SectionContext, position: number): DraftSection {
  const section = sanitizeSection({ ...raw, id: newId(), typeId: type.id, cuts: [] }, ctx.input, ctx.evidence)!;
  section.items = section.items.slice(0, type.items[1]);
  const photoCount = ctx.input.productImagePaths.length;
  const rawCuts = Array.isArray(raw.cuts) ? raw.cuts : [];
  const count = expectedCutCount(type, section.items.length);
  section.cuts = Array.from({ length: count }, (_, i) => {
    const cut = sanitizeCut(rawCuts[i], photoCount, section.items.length);
    if (type.cuts === 'perItem') cut.itemIndex = i;
    if (type.cuts === 'one') cut.itemIndex = null;
    // 참고 사진도 섹션마다 돌려 써서 같은 사진만 반복되지 않게
    if (!(rawCuts[i] as { photoIndexes?: unknown })?.photoIndexes && photoCount) cut.photoIndexes = [(position + i) % photoCount];
    cut.source = defaultCutSource(ctx.input.imageMode, cut.role, photoCount);
    if (!ctx.input.model.enabled || !type.modelCapable) cut.modelAllowed = false;
    return cut;
  });
  return section;
}

/** AI가 실패했을 때 판매자가 직접 채울 수 있는 빈 섹션 */
function placeholderSection(type: SectionType, ctx: SectionContext, position: number, reason: string): DraftSection {
  const items = Array.from({ length: type.items[0] }, (_, i) => ({ title: { text: `항목 ${i + 1}`, evidence: [] }, text: { text: '[입력 필요]', evidence: [] } }));
  const section = finalizeSection({ title: { text: type.name, evidence: [] }, items }, type, ctx, position);
  section.warnings = [reason];
  return section;
}

const sectionLimit = pLimit(4);

const neighborsOf = (types: SectionType[], index: number) => types.map((t, j) => (j === index ? `[${t.name}]` : t.name)).join(' → ');

async function writeSections(draftId: string, gemini: GeminiClient, ctx: SectionContext, types: SectionType[], outline: Outline) {
  let done = 0;
  return Promise.all(
    types.map((type, i) =>
      sectionLimit(async () => {
        const section = await writeSection(gemini, ctx, type, neighborsOf(types, i), i, outline).catch((err) => {
          console.error('[lever] draft section failed', type.id, err);
          return placeholderSection(type, ctx, i, 'AI가 이 섹션 문구를 쓰지 못했어요. 직접 입력해 주세요.');
        });
        done += 1;
        await setProgress(draftId, { step: 'copy', message: '전환율을 높이는 카피를 쓰고 있어요', current: done, total: types.length });
        return section;
      }),
    ),
  );
}

/** 다시 쓰는 섹션 수 상한 (문구 모델 호출 비용) */
const MAX_REWRITES = 5;

/** 섹션끼리 같은 사실·문장을 되풀이하면 그 섹션만 한 번 다시 쓰고, 그래도 남으면 경고로 알린다 */
async function reviseRepeats(gemini: GeminiClient, ctx: SectionContext, types: SectionType[], outline: Outline, sections: DraftSection[], facts: FactEntry[]) {
  const keywords = factKeywords(facts);
  const problems = findRepeats(sections, keywords, outline.owners, facts);
  const targets = [...problems.keys()].slice(0, MAX_REWRITES);
  const next = [...sections];
  await Promise.all(
    targets.map((i) =>
      sectionLimit(async () => {
        const rewritten = await writeSection(gemini, ctx, types[i], neighborsOf(types, i), i, outline, problems.get(i)).catch(() => null);
        if (rewritten) next[i] = rewritten;
      }),
    ),
  );
  const remaining = findRepeats(next, keywords, outline.owners, facts);
  return next.map((s, i) => (remaining.has(i) ? { ...s, warnings: [...new Set([...s.warnings, `반복: ${remaining.get(i)!.join(' / ')}`])] } : s));
}

// ===== 기획 Job =====

/** "기존 페이지 활용하기": 원본 페이지의 섹션 구성·색은 그대로, 내용만 새 상품으로 */
async function reuseOutline(input: DraftInput) {
  if (input.startMode !== 'reuse' || !input.reuseSourceProjectId) return null;
  const source = await getProject(input.reuseSourceProjectId).catch(() => null);
  return source?.draftLayout ?? null;
}

async function runPlan(draftId: string) {
  try {
    const draft = await getDraft(draftId);
    const input = draft.input;
    const previousStyle = draft.plan?.designStyle;
    const gemini = await requireGemini();
    await setProgress(draftId, { step: 'photos', message: `사진 ${input.productImagePaths.length}장을 살펴보고 있어요` });

    const [analyzed, reviewQuotes] = await Promise.all([
      analyzeProduct(gemini, input, evidenceText(input)),
      input.reviewImagePaths.length ? transcribeReviews(gemini, input.reviewImagePaths).catch(() => []) : Promise.resolve([]),
    ]);
    analyzed.analysis.reviewQuotes = reviewQuotes;
    await setProgress(draftId, { step: 'colors', message: '상품에 어울리는 색을 골랐어요' });

    const reuse = await reuseOutline(input);
    const keys = evidenceKeys(input, reviewQuotes);
    const available = suggestableTypes(input.categoryId).filter((t) => !lockedReason(t, keys));
    const fallback = defaultFlow(input.categoryId, input.length, (t) => !lockedReason(t, keys));
    await setProgress(draftId, { step: 'facts', message: '상품 정보를 정리했어요' });

    const facts = allocatableFacts(evidenceEntries(input, reviewQuotes));
    const reuseIds = reuse?.sectionTypeIds.filter((id) => available.some((t) => t.id === id));
    const planned = reuseIds ? { ids: reuseIds, owners: defaultOwners(reuseIds, facts) } : await planOutline(gemini, input, available, fallback, facts);
    const outline = { ...planned, ids: withAiNotice(planned.ids, input.imageMode === 'ai') };
    const types = outline.ids.map((id) => findSectionType(input.categoryId, id)).filter((t): t is SectionType => Boolean(t));
    await setProgress(draftId, {
      step: 'matching',
      message: '사진과 상품 정보를 맞춰 보고 있어요',
      current: 0,
      total: types.length,
      outline: types.map((t) => ({ typeId: t.id, name: t.name })),
    });

    const ctx = sectionContext(input, analyzed.analysis);
    const written = await writeSections(draftId, gemini, ctx, types, outline);
    await setProgress(draftId, { step: 'copy', message: '섹션끼리 겹치는 말을 다듬고 있어요' });
    const sections = await reviseRepeats(gemini, ctx, types, outline, written, facts);
    const plan: DraftPlan = {
      sections,
      palette: reuse?.palette ?? analyzed.palette,
      paletteReason: reuse ? '기존 페이지의 색 조합을 그대로 가져왔어요' : analyzed.paletteReason,
      designStyle: reuse?.designStyle ?? previousStyle,
      analysis: analyzed.analysis,
    };
    await updateDraft(draftId, (d) => ({
      ...d,
      status: 'ready',
      plan,
      progress: { ...d.progress!, step: 'done', message: '기획 초안이 준비됐어요', current: types.length, total: types.length },
      revision: d.revision + 1,
    }));
  } catch (err) {
    console.error('[lever] draft plan failed', err);
    const message = err instanceof ApiError ? err.message : '기획 초안을 만들지 못했어요. 다시 시도해주세요.';
    await updateDraft(draftId, (d) => ({ ...d, status: 'plan_failed', errorMessage: message }));
  }
}

export function validateForPlan(input: DraftInput) {
  if (!input.productName.trim()) throw badRequest('상품명을 입력해주세요.');
  if (!input.productImagePaths.length) throw badRequest('상품 사진을 1장 이상 올려주세요.');
  if (!findCategory(input.categoryId)) throw badRequest('카테고리를 선택해주세요.');
  if (!input.features.trim()) throw badRequest('제품 주요 특징을 입력해주세요.');
}

/** POST /drafts/{id}/plan */
export async function startPlan(draftId: string) {
  const draft = await getDraft(draftId);
  if (draft.status === 'planning' || draft.status === 'generating') throw badRequest('이미 진행 중인 작업이 있습니다.');
  validateForPlan(draft.input);
  await requireGemini();
  const updated = await updateDraft(draftId, (d) => ({
    ...d,
    status: 'planning',
    errorMessage: null,
    progress: {
      step: 'photos',
      message: `사진 ${d.input.productImagePaths.length}장을 올렸어요`,
      current: 0,
      total: 0,
      outline: [],
    },
  }));
  void runPlan(draftId);
  return updated;
}

// ===== 섹션 추가 =====

/** POST /drafts/{id}/sections — 섹션 하나를 AI로 써서 원하는 위치에 넣는다 */
export async function addSection(draftId: string, body: { typeId?: string; index?: number }) {
  const draft = await getDraft(draftId);
  if (!draft.plan) throw badRequest('기획 초안을 먼저 만들어주세요.');
  const type = findSectionType(draft.input.categoryId, String(body.typeId ?? ''));
  if (!type) throw badRequest('섹션 종류를 확인해주세요.');
  const reviewQuotes = draft.plan.analysis?.reviewQuotes ?? [];
  const reason = lockedReason(type, evidenceKeys(draft.input, reviewQuotes));
  if (reason) throw badRequest(reason);

  const ctx = sectionContext(draft.input, draft.plan.analysis);
  const existingIds = draft.plan.sections.map((s) => s.typeId);
  const names = existingIds.map((id) => sectionName(draft.input.categoryId, id));
  const clampIndex = (length: number) => (Number.isInteger(body.index) ? Math.min(Math.max(Number(body.index), 0), length) : length);
  const position = clampIndex(names.length);
  const ids = [...existingIds.filter((id) => id !== type.id), type.id];
  const outline = { ids, owners: defaultOwners(ids, allocatableFacts(evidenceEntries(draft.input, reviewQuotes))) };
  const section = await requireGemini()
    .then((gemini) => writeSection(gemini, ctx, type, names.join(' → '), position, outline))
    .catch(() => placeholderSection(type, ctx, position, 'AI 문구 작성에 실패해 빈 섹션을 넣었어요. 직접 입력해 주세요.'));

  return updateDraft(draftId, (d) => {
    const sections = [...(d.plan?.sections ?? [])];
    const index = clampIndex(sections.length);
    sections.splice(index, 0, section);
    return { ...d, plan: { ...d.plan!, sections }, revision: d.revision + 1 };
  });
}

// ===== AI로 내용 채우기 =====

/** POST /drafts/{id}/autofill — 상품명 + 사진으로 카테고리·특징·옵션·모델을 채운다 (비어 있는 칸만) */
export async function autofillDraft(draftId: string) {
  const draft = await getDraft(draftId);
  const { input } = draft;
  if (!input.productName.trim() || !input.productImagePaths.length) throw badRequest('상품명과 사진 1장 이상을 먼저 입력해주세요.');
  const gemini = await requireGemini();
  const photos = await loadInlineImages(input.productImagePaths, 6);
  const result = await gemini.generateJson<{
    categoryId?: string;
    features?: string[];
    options?: { name?: string; spec?: string }[];
    model?: { recommended?: boolean; description?: string };
  }>(
    `너는 한국 이커머스 상품 등록 도우미다. 상품명과 사진만 보고 입력 칸을 채워라.
상품명: ${input.productName}
카테고리 목록: ${CATEGORIES.map((c) => `${c.id}(${c.name})`).join(', ')}

JSON: {"categoryId":"목록의 id","features":["사진과 상품명으로 확인되는 특징 5개(한 줄씩)"],"options":[{"name":"옵션 이름","spec":"용량·크기"}],"model":{"recommended":false,"description":"인물 연출이 도움이 되면 원하는 모델 설명 40자"}}
규칙: 사진·상품명으로 확인되지 않는 수치·인증·효능·원산지는 쓰지 않는다. 옵션은 사진에서 보일 때만.`,
    photos,
  );
  return updateDraft(draftId, (d) => {
    const next = { ...d.input };
    if (!next.categoryId && findCategory(result.categoryId)) next.categoryId = String(result.categoryId);
    if (!next.features.trim()) next.features = strings(result.features, 8).map((f, i) => `${i + 1}. ${f}`).join('\n');
    if (!next.options.length) {
      next.options = (result.options ?? [])
        .filter((o) => o?.name)
        .slice(0, 10)
        .map((o) => ({ name: String(o.name).slice(0, 100), spec: String(o.spec ?? '').slice(0, 100) }));
    }
    if (!next.model.description && result.model?.recommended) {
      next.model = { ...next.model, enabled: true, description: String(result.model.description ?? '').slice(0, 80) };
    }
    return { ...d, input: next };
  });
}

// ===== 다른 색 조합 =====

/** POST /drafts/{id}/palette/shuffle — 현재와 다른 프리셋 4개 */
export async function shufflePalettes(draftId: string) {
  const draft = await getDraft(draftId);
  const current = draft.plan?.palette.main;
  const pool = TONE_PRESETS.filter((t) => derivePalette(t.main).main !== current).sort(() => Math.random() - 0.5);
  return pool.slice(0, 4).map((t) => ({ palette: derivePalette(t.main), reason: `${t.name} 톤으로 바꿔 봤어요` }));
}

// ===== 외부 AI용 기획안 작성 가이드 =====

/** GET /drafts/{id}/plan-guide — GPT·Claude에 붙여 넣을 기획안 작성 프롬프트 */
export async function planGuidePrompt(draftId: string) {
  const { input } = await getDraft(draftId);
  const [min, max] = LENGTH_TARGET[input.length];
  const features = input.features.trim() || '(입력 없음)';
  const options = input.options.filter((o) => o.name.trim());
  const prompt = `당신은 한국 이커머스 상세페이지 기획자입니다. 아래 상품의 상세페이지 기획안을 작성해 주세요.

## 상품 정보
- 상품명: ${input.productName || '(입력 필요)'}
- 카테고리: ${findCategory(input.categoryId)?.name ?? '(선택 안 함)'}
- 주요 특징:
${features}
- 규격·용량: ${options.length ? options.map((o) => `${o.name} ${o.spec}`.trim()).join(', ') : '확인된 정보 없음. 수치를 추측하지 마세요.'}
- 판매 옵션: ${options.length ? options.map((o) => o.name).join(', ') : '확인된 정보 없음. 추측하지 마세요.'}
- 상품 사진: ${input.productImagePaths.length}장 (윙스팜AI에 올린 사진은 자동으로 전달되지 않으니 이 대화에 함께 첨부해 주세요)
- 구성 길이: ${min}~${max}개 섹션, 전체 3,000자 이내

## 작성 규칙
1. 제공한 정보만 사실로 사용하세요. 수치·소재·원산지·인증·효능·가격·실제 후기는 추측하지 말고, 모르면 먼저 질문하고 확인되지 않은 주장은 빼세요.
2. 문서 처음에 확인된 상품 정보를 한 번만 정리하고, 그 뒤에는 섹션별 카피와 이미지 연출만 쓰세요.
3. 섹션 제목은 "섹션 01: 역할" 형식, 카피는 "메인 문구 / 설명 문구 / 특징 1, 2, 3…" 형식으로 쓰세요.
4. 이미지 연출은 장면마다 대상·상황·구도·조명을 구체적으로 쓰고, 특징별 사진은 같은 번호로 연결하세요.
5. 상품 외형·색·포장·수량은 사진대로 유지하고, 내부 구조·제조 시설·사용 전후 효과는 지어내지 마세요. 광고 문구는 이미지 연출이 아니라 카피에 쓰세요.
6. 메인 문구는 짧게 쓰고, 픽셀·좌우 위치·글꼴 크기는 지정하지 마세요.
7. 전체 3,000자 이내로 쓰세요.
8. 예시 문구나 확인되지 않은 항목은 완성본에 남기지 말고, Markdown으로 출력하세요.

## ${NATURAL_COPY_RULES}

## 양식
# ${input.productName || '[상품명]'} 상세페이지 기획안
## 확인된 상품 정보
- 상품명 / 카테고리 / 주요 특징 / 규격·용량 / 옵션 / 사용 방법
## 섹션 01: 첫 화면
### 카피라이팅
메인 문구: …
설명 문구: …
### 이미지 연출
…
## 섹션 02: 주요 특징
### 카피라이팅
메인 문구: …
특징 1: … / 특징 2: … / 특징 3: …
### 이미지 연출
특징 1: … / 특징 2: … / 특징 3: …

(제목은 섹션의 역할이고, 화면에 나올 문구는 메인 문구에 씁니다. 윙스팜AI가 실제 템플릿의 문구 칸·사진 컷·인물 조건에 맞춰 배치합니다.)`;
  return { prompt };
}

export type { DraftRecord };

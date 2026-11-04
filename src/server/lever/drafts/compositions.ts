/**
 * 구성 후보 5안 — 상품에 맞는 섹션 목차·스타일을 AI가 제안하고 사용자가 고른다.
 * 문구/컷은 선택 후 startPlan → runPlan에서 작성한다.
 *
 * 응답은 동기적으로 candidates를 채운 뒤 status=choosing 으로 돌려,
 * 클라이언트가 바로 선택 화면을 그리게 한다.
 */
import 'server-only';
import type { CompositionCandidate, DraftInput } from '@/shared/types/draft';
import { DESIGN_STYLE_OPTIONS } from '@/shared/lib/designStyles';
import { findCategory } from '../catalog/categories';
import { suggestProductTones, TONE_PRESETS } from '../catalog/palette';
import { LENGTH_TARGET, suggestableTypes } from '../catalog/sections';
import { allocatableFacts } from './factPlan';
import {
  buildFallbackCompositionCandidates,
  COMPOSITION_CANDIDATE_COUNT,
  COMPOSITION_STRATEGIES,
  compositionSequenceKey,
  parseGeminiCandidates,
} from './compositionLogic';
import { requireGemini, type GeminiClient } from '../gemini';
import { badRequest } from '../http';
import { newId } from '../store';
import { evidenceEntries, evidenceKeys, getDraft, lockedReason, updateDraft } from './repo';

function allowedTypeIds(input: DraftInput) {
  const keys = evidenceKeys(input);
  return suggestableTypes(input.categoryId)
    .filter((t) => !lockedReason(t, keys))
    .map((t) => t.id);
}

const withTimeout = async <T,>(promise: Promise<T>, ms: number, label: string) => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timeout`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

/**
 * 1) 전략별 스토리 흐름(beats)을 먼저 짜고
 * 2) 그 흐름에 섹션 id를 매핑한 뒤
 * 3) 역할 중복·길이·세일즈 순서를 스스로 재검토한다.
 * (템플릿을 아무거나 채워 넣는 방식이 아니라, 흐름 판단이 먼저다)
 */
async function askGeminiCandidates(
  gemini: GeminiClient,
  input: DraftInput,
  excludeKeys: Set<string>,
): Promise<CompositionCandidate[]> {
  const allowed = allowedTypeIds(input);
  const available = suggestableTypes(input.categoryId).filter((t) => allowed.includes(t.id));
  const facts = allocatableFacts(evidenceEntries(input));
  const [minLen, maxLen] = LENGTH_TARGET[input.length];
  const styles = DESIGN_STYLE_OPTIONS.map((s) => `${s.id}:${s.name}`).join(', ');
  const recommended = suggestProductTones(input.productName, input.categoryId);
  const tones = TONE_PRESETS.map((t) => t.id).join(', ');
  const avoid = [...excludeKeys].slice(0, 6).join('\n') || '없음';
  const strategyLines = COMPOSITION_STRATEGIES.map((s, i) => `${i + 1}) ${s.id} — ${s.hint}`).join('\n');

  const productBlock = `[상품] ${input.productName} (${findCategory(input.categoryId)?.name})
[판매자 기획안] ${input.plan.trim() || '없음'}
[길이 선호] ${input.length} (섹션 ${minLen}~${maxLen}개 — 이보다 짧게 만들지 말 것. conversion만 예외적으로 약간 짧게 가능)
[상품 사실]
${facts.map((f) => `${f.id}: ${f.text}`.slice(0, 200)).join('\n') || '없음'}`;

  // —— 1단계: 흐름만 설계 (섹션 id 금지) ——
  const flows = await gemini.generateJson<{
    flows?: { strategy?: string; title?: string; reason?: string; beats?: { role?: string; purpose?: string }[] }[];
  }>(
    `너는 한국 이커머스 상세페이지 **스토리보드** 기획자다. 템플릿을 고르기 전에, 상품을 설득하는 **페이지 흐름**만 짠다.

${productBlock}

전략 ${COMPOSITION_CANDIDATE_COUNT}개 (서로 다른 설득 각도):
${strategyLines}

각 전략마다 beats(이야기 박자)를 ${Math.min(minLen, 10)}~${maxLen}개 적어라.
role은 역할 이름만 (예: 첫인상, 한줄소개, 신뢰증거, 상품근거, 산지스토리, 먹는법, 누구에게추천, 구매유도, 배송안내).
purpose는 그 박자가 손님에게 하는 일 한 줄.

절대 금지:
- 같은 역할(특히 "누구에게추천" / "이런 분께")을 한 흐름에 두 번
- 섹션 id·템플릿 이름 언급 (흐름만)

JSON:
{"flows":[{"strategy":"conversion","title":"12자 이내","reason":"~어요 40자","beats":[{"role":"첫인상","purpose":"..."}]}]}`,
  );

  const flowRows = Array.isArray(flows.flows) ? flows.flows : [];

  // —— 2단계: 흐름 → 섹션 id 매핑 + 재검토 ——
  const result = await gemini.generateJson<{ candidates?: unknown[] }>(
    `너는 상세페이지 구성 편집자다. 아래 **이미 짜 둔 흐름**에 맞춰 섹션 id를 고르고, 한 번 더 검토하라.

${productBlock}
[쓸 수 있는 섹션] (id: 이름 — 역할)
${available.map((t) => `${t.id}: ${t.name} — ${t.description}`).join('\n')}
[디자인 스타일] ${styles}
[색감 세트 toneId] ${tones} / 상품 추천 톤 ${recommended.join(', ')}
[피해야 할 이전 시퀀스]
${avoid}

[확정된 흐름]
${JSON.stringify(flowRows).slice(0, 6000)}

매핑·재검토 규칙:
1) beats 순서대로 가장 알맞은 section id 하나. 첫 칸은 반드시 hero.
2) 같은 section id 중복 금지. "누구에게추천" 역할 → recommend 최대 1개. summary와 concept 동시 사용 금지(하나만).
3) 근거 필요 섹션(후기·인증 등)은 사실에 있을 때만.
4) 세일즈 큰 순서: hero → 소개 → 신뢰 → 상품근거 → 산지 → 활용 → 옵션 → 구매유도 → 배송·FAQ.
5) 농수산이면 맨 끝 shipping_method, return_policy, product_notice.
6) lengthHint 기본값은 "${input.length}". conversion만 short 가능. 섹션 수는 ${minLen}~${maxLen}.
7) 흐름에 없는 섹션을 끼워 길이를 억지로 늘리지 말 것. 부족하면 같은 전략에 맞는 근거·활용 박지만 추가.
8) 후보마다 sectionIds가 달라야 한다.
9) 후보마다 toneId를 서로 다르게 — 추천 톤(${recommended.join(', ')})을 우선 배분. 한 후보 안에서는 초록·남색·빨강이 섞이지 않게 색감 세트 하나(toneId 하나)만 쓴다.

JSON:
{"candidates":[{"strategy":"conversion","title":"...","reason":"...","sectionIds":["hero","..."],"designStyle":"modern","toneId":"${recommended[0] ?? 'forest'}","lengthHint":"short|long|extra"}]}`,
  );

  const rows = Array.isArray(result.candidates) ? result.candidates : [];
  return parseGeminiCandidates(rows, input, allowed, excludeKeys, newId);
}

async function buildCandidates(input: DraftInput, excludeKeys: Set<string>) {
  const allowed = allowedTypeIds(input);
  const fallback = buildFallbackCompositionCandidates(input, allowed, excludeKeys);
  try {
    const gemini = await requireGemini();
    // 흐름→매핑 2단 Gemini라 여유 타임아웃
    return await withTimeout(askGeminiCandidates(gemini, input, excludeKeys), 28_000, 'compositions');
  } catch (err) {
    console.warn('[lever] compositions fallback', err instanceof Error ? err.message : err);
    return fallback;
  }
}

async function beginCompose(draftId: string, reshuffle: boolean) {
  const { startPlan, validateForPlan } = await import('./plan');
  const draft = await getDraft(draftId);
  if (['composing', 'planning', 'generating'].includes(draft.status)) {
    throw badRequest('이미 진행 중인 작업이 있습니다.');
  }
  validateForPlan(draft.input);

  if (draft.input.startMode === 'reuse' && draft.input.reuseSourceProjectId) {
    return startPlan(draftId);
  }

  const excludeKeys = reshuffle
    ? new Set((draft.candidates ?? []).map((c) => compositionSequenceKey(c.sectionTypeIds)))
    : new Set<string>();
  const candidates = await buildCandidates(draft.input, excludeKeys);

  return updateDraft(draftId, (d) => ({
    ...d,
    status: 'choosing',
    candidates,
    selectedCandidateId: null,
    plan: null,
    errorMessage: null,
    progress: {
      step: 'done',
      message: `구성 후보 ${COMPOSITION_CANDIDATE_COUNT}안이 준비됐어요`,
      current: COMPOSITION_CANDIDATE_COUNT,
      total: COMPOSITION_CANDIDATE_COUNT,
      outline:
        candidates[0]?.sectionTypeIds.map((id, i) => ({
          typeId: id,
          name: candidates[0].sectionNames[i] ?? id,
        })) ?? [],
    },
    revision: d.revision + 1,
  }));
}

/** POST /drafts/:id/compositions */
export function startCompositions(draftId: string) {
  return beginCompose(draftId, false);
}

/** POST /drafts/:id/compositions/reshuffle */
export function reshuffleCompositions(draftId: string) {
  return beginCompose(draftId, true);
}

/** POST /drafts/:id/compositions/select */
export async function selectComposition(draftId: string, body: { candidateId?: string }) {
  const { startPlan } = await import('./plan');
  const draft = await getDraft(draftId);
  if (draft.status === 'composing' || draft.status === 'planning' || draft.status === 'generating') {
    throw badRequest('이미 진행 중인 작업이 있습니다.');
  }
  const candidateId = typeof body?.candidateId === 'string' ? body.candidateId : '';
  const candidate = draft.candidates?.find((c) => c.id === candidateId);
  if (!candidate) throw badRequest('구성 후보를 선택해주세요.');

  await updateDraft(draftId, (d) => ({
    ...d,
    selectedCandidateId: candidate.id,
    revision: d.revision + 1,
  }));
  return startPlan(draftId);
}

export {
  buildFallbackCompositionCandidates,
  compositionSequenceKey,
  resolveCandidateSectionIds,
} from './compositionLogic';

import type { DraftSection } from '@/shared/types/draft';

/**
 * 사실 배분 — 상품 사실 하나는 한 섹션이 맡아 자세히 쓰고, 다른 섹션은 되풀이하지 않는다
 *
 * 사실이 적은데 섹션이 많으면 AI가 같은 사실(예: 당도 16brix)을 섹션마다 말만 바꿔 채운다.
 * 그래서 ① 섹션마다 맡을 사실을 정하고 ② 맡을 사실이 없는 섹션은 빼고 ③ 다 쓴 뒤 반복을 검사한다.
 * (네트워크 없이 테스트할 수 있게 순수 함수만 둔다)
 */
export interface FactEntry {
  id: string;
  text: string;
}

/** 섹션 종류 id → 맡은 사실 id (후기·옵션·인증은 묶음 id: review / option / certification) */
export type FactOwners = Record<string, string[]>;

/** 맡을 사실이 없어도 되는 섹션 — 첫 화면·분위기·일반 정보(먹는 법·보관·질문·배송·고지) */
export const FACT_FREE_SECTIONS: ReadonlySet<string> = new Set([
  'hero',
  'concept',
  'recipe',
  'storage_washing',
  'faq',
  'contact',
  'delivery',
  'shipping_method',
  'return_policy',
  'product_notice',
  'conversion',
  'notice_ai',
  'data_notice',
  'usage',
  'how_to',
  'styling',
  'problem',
  'problem_cause',
  'season_banner',
  'season_delivery_schedule',
  'package',
  'spec',
  'location',
  'dosage',
]);

/** 섹션을 고르는 데 쓰지 않는 근거 (모든 섹션의 배경 정보) */
const BACKGROUND_FACTS = new Set(['product:name', 'product:category', 'brand', 'plan']);
const GROUPED = /^(review|option|certification):/;

export const factGroupId = (id: string) => (GROUPED.test(id) ? id.split(':')[0] : id);

/** 배분할 사실 목록 — 후기·옵션·인증은 하나로 묶는다 */
export function allocatableFacts(entries: FactEntry[]): FactEntry[] {
  const groups = new Map<string, FactEntry & { count: number }>();
  for (const entry of entries) {
    if (BACKGROUND_FACTS.has(entry.id)) continue;
    const id = factGroupId(entry.id);
    const group = groups.get(id);
    if (group) group.count += 1;
    else groups.set(id, { id, text: entry.text, count: 1 });
  }
  return [...groups.values()].map(({ id, text, count }) => ({ id, text: count > 1 ? `${text} 외 ${count - 1}건` : text }));
}

/** AI가 정한 배분을 검사: 아는 사실만, 사실 하나는 먼저 나온 섹션 하나만 */
export function normalizeOwners(ids: string[], raw: Record<string, unknown>, facts: FactEntry[]): FactOwners {
  const known = new Set(facts.map((f) => f.id));
  const taken = new Set<string>();
  const owners: FactOwners = {};
  for (const id of ids) {
    owners[id] = [];
    for (const value of Array.isArray(raw[id]) ? (raw[id] as unknown[]) : []) {
      const fact = factGroupId(String(value));
      if (!known.has(fact) || taken.has(fact)) continue;
      taken.add(fact);
      owners[id].push(fact);
    }
  }
  return owners;
}

/** 근거 종류별로 맡기 좋은 섹션 (앞에 있을수록 우선) */
const PREFERRED_OWNER: [string, string[]][] = [
  ['agri:origin', ['point_origin', 'point_origin_reason']],
  ['agri:harvest', ['season']],
  ['agri:selection', ['selection_process', 'comparison']],
  ['agri:producer', ['point_producer', 'point_producer_reason']],
  ['agri:direct', ['point_direct']],
  ['sales', ['social_proof']],
  ['certification', ['certification', 'functional']],
  ['review', ['review']],
  ['option', ['options', 'set_line_up', 'spec']],
  ['promotion', ['promotion', 'benefit']],
  ['facility', ['facility', 'no_additive', 'development']],
  ['shipping', ['delivery', 'shipping_method']],
  ['contact', ['contact', 'location']],
  ['size', ['size_comparison', 'spec']],
  ['sensory', ['taste', 'texture', 'quality']],
];

/** 특징 줄을 나눠 맡을 섹션 */
const FEATURE_OWNERS = ['quality', 'point_sum', 'detail', 'taste', 'texture', 'fabric', 'comparison', 'usp', 'solution', 'modes', 'formulation'];

/** AI 배분이 없을 때(실패·기존 페이지 활용)의 기본 배분 */
export function defaultOwners(ids: string[], facts: FactEntry[]): FactOwners {
  const owners: FactOwners = Object.fromEntries(ids.map((id) => [id, []]));
  const featureOwners = FEATURE_OWNERS.filter((id) => ids.includes(id));
  let next = 0;
  for (const fact of facts) {
    const preferred = PREFERRED_OWNER.find(([key]) => key === fact.id)?.[1].find((id) => ids.includes(id));
    if (preferred) owners[preferred].push(fact.id);
    else if (fact.id.startsWith('feature:') && featureOwners.length) owners[featureOwners[next++ % featureOwners.length]].push(fact.id);
  }
  return owners;
}

/** 맡을 사실이 없는 섹션은 뺀다 (첫 화면·일반 정보 섹션은 남긴다) */
export const pruneOutline = (ids: string[], owners: FactOwners) => ids.filter((id) => FACT_FREE_SECTIONS.has(id) || (owners[id]?.length ?? 0) > 0);

// ===== 반복 검사 =====

const compact = (text: string) => text.toLowerCase().replace(/브릭스/g, 'brix').replace(/\s+/g, '');

const NUMBER_TOKEN = /\d+(?:[.~-]\d+)*(?:brix|kg|g|%|개|과|월|일|시|위|년|cm|mm|ml|l|박스|등급)?/g;

/** 여러 곳에 나와도 자연스러운 사실 (후기 인용 속 숫자·전화번호) */
const KEYWORD_SKIP = new Set(['review', 'contact']);

/** 상품 사실에 나온 수치(단위 포함)와 짧은 산지·제철 값 — 이 말이 섹션마다 나오면 반복이다 */
export function factKeywords(facts: FactEntry[]) {
  const keywords = new Set<string>();
  for (const fact of facts) {
    if (KEYWORD_SKIP.has(fact.id)) continue;
    const value = fact.text.slice(fact.text.indexOf(':') + 1);
    for (const token of compact(value).match(NUMBER_TOKEN) ?? []) if (token.length >= 2) keywords.add(token);
    if ((fact.id === 'agri:origin' || fact.id === 'agri:harvest') && compact(value).length <= 12) keywords.add(compact(value));
  }
  return [...keywords];
}

const linesOf = (s: DraftSection) => [s.title, s.subtitle, ...s.items.flatMap((i) => [i.title, i.text])].flatMap((l) => (l?.text.trim() ? [l.text] : []));

const bigrams = (text: string) => {
  const t = compact(text).replace(/[^\p{L}\p{N}]/gu, '');
  return new Set(Array.from({ length: Math.max(t.length - 1, 0) }, (_, i) => t.slice(i, i + 2)));
};

/** 두 문장이 얼마나 겹치는지 (0~1, 두 글자 조각 기준) */
export function similarity(a: string, b: string) {
  const x = bigrams(a);
  const y = bigrams(b);
  if (x.size < 5 || y.size < 5) return 0;
  let common = 0;
  for (const g of x) if (y.has(g)) common += 1;
  return (2 * common) / (x.size + y.size);
}

/** 반복을 따지지 않는 섹션 (첫 화면 키워드·고지문) */
const REPEAT_EXEMPT = new Set(['hero', 'notice_ai', 'data_notice']);
/** 같은 수치·산지가 나와도 되는 섹션 수 (맡은 섹션 + 한 번 더) */
const MAX_SECTIONS_PER_KEYWORD = 2;
const MAX_LINES_PER_KEYWORD = 2;
const NEAR_DUPLICATE = 0.6;

/**
 * 페이지 전체 반복 검사 → 섹션 순번별 문제 목록
 * - 같은 수치·산지가 3개 이상 섹션에 나옴 (맡은 섹션과 처음 나온 곳은 허용)
 * - 한 섹션 안에서 같은 수치를 3줄 이상 되풀이
 * - 거의 같은 문장이 두 번 나옴
 */
export function findRepeats(sections: DraftSection[], keywords: string[], owners: FactOwners = {}, facts: FactEntry[] = []) {
  const problems = new Map<number, string[]>();
  const flag = (index: number, message: string) => problems.set(index, [...new Set([...(problems.get(index) ?? []), message])]);
  const checked = sections.map((s, index) => ({ index, s, lines: linesOf(s).map((text) => ({ text, compact: compact(text) })) })).filter(({ s }) => !REPEAT_EXEMPT.has(s.typeId));

  for (const keyword of keywords) {
    const using = checked.filter(({ lines }) => lines.some((l) => l.compact.includes(keyword)));
    for (const { index, lines } of using) {
      if (lines.filter((l) => l.compact.includes(keyword)).length > MAX_LINES_PER_KEYWORD) flag(index, `"${keyword}"를 한 섹션에서 여러 번 말해요`);
    }
    if (using.length <= MAX_SECTIONS_PER_KEYWORD) continue;
    const ownerFacts = facts.filter((f) => compact(f.text).includes(keyword)).map((f) => f.id);
    const owner = using.find(({ s }) => (owners[s.typeId] ?? []).some((id) => ownerFacts.includes(id)));
    const allowed = new Set([owner?.index, ...using.filter((u) => u !== owner).slice(0, MAX_SECTIONS_PER_KEYWORD - (owner ? 1 : 0)).map((u) => u.index)]);
    for (const { index } of using) if (!allowed.has(index)) flag(index, `"${keyword}"를 다른 섹션에서 이미 말했어요`);
  }

  const all = checked.flatMap(({ index, lines }) => lines.map((l) => ({ index, text: l.text })));
  all.forEach((a, i) => {
    for (const b of all.slice(i + 1)) {
      if (similarity(a.text, b.text) >= NEAR_DUPLICATE) flag(b.index, `"${b.text.slice(0, 20)}…"와 거의 같은 문장이 이미 있어요`);
    }
  });
  return problems;
}

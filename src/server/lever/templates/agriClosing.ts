/**
 * 농수산물 상세페이지 맨 뒤에 꼭 넣는 구성
 * 스마트스토어 관행: 본문 → 배송 → 교환·환불 → 상품정보 제공고시
 */
export const AGRI_CLOSING_SLOTS = [
  { id: 'shipping', part2: '배송 안내', prefer: ['-delivery-', '-week-', '-coldchain-', '-packing-'] },
  { id: 'return', part2: '구매 안내', prefer: ['-policy-', '-warning-'] },
  { id: 'spec', part2: '상세 정보', prefer: ['-notice-', '-boxed-', '-table'] },
] as const;

export type ClosingPickable = { id: string; name?: string; part2: string };

const matchesPrefer = (template: ClosingPickable, prefer: readonly string[]) =>
  prefer.some((needle) => template.id.includes(needle) || (template.name ?? '').includes(needle.replace(/-/g, '')));

export function pickClosingTemplate<T extends ClosingPickable>(
  usable: readonly T[],
  used: ReadonlySet<string>,
  slot: (typeof AGRI_CLOSING_SLOTS)[number],
  preferredStyle?: string,
  styleOf?: (template: T) => string,
): T | undefined {
  const pool = usable.filter((t) => !used.has(t.id));
  const inPart = pool.filter((t) => t.part2 === slot.part2);
  const inPartPreferred = inPart.filter((t) => matchesPrefer(t, slot.prefer));
  const otherPreferred = pool.filter((t) => t.part2 !== slot.part2 && matchesPrefer(t, slot.prefer));
  const ranked = [...inPartPreferred, ...inPart, ...otherPreferred];
  if (preferredStyle && styleOf) {
    const same = ranked.filter((t) => styleOf(t) === preferredStyle);
    if (same[0]) return same[0];
  }
  return ranked[0];
}

export function withAgriClosing<T extends ClosingPickable>(
  usable: readonly T[],
  picked: T[],
  categoryId: string | null | undefined,
  preferredStyle?: string,
  styleOf?: (template: T) => string,
): T[] {
  if (categoryId !== 'agri') return picked;
  const used = new Set(picked.map((t) => t.id));
  const extra: T[] = [];
  for (const slot of AGRI_CLOSING_SLOTS) {
    const next = pickClosingTemplate(usable, used, slot, preferredStyle, styleOf);
    if (!next) continue;
    used.add(next.id);
    extra.push(next);
  }
  return [...picked, ...extra];
}


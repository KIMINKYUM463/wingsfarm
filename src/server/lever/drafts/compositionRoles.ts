/**
 * 구성 후보에서 같은 페이지 역할을 두 번 쓰지 않기 위한 순수 유틸 (단위 테스트 가능)
 */

/**
 * 같은 역할(잡)을 두 번 쓰지 않는다.
 * 예: summary+concept, usage+how_to — 앞에 나온 것만 남긴다.
 * recommend(누구에게 추천)는 한 후보에 한 번만.
 */
export const EXCLUSIVE_ROLE_GROUPS: readonly (readonly string[])[] = [
  ['summary', 'concept'],
  ['usage', 'how_to'],
  ['recommend'],
  ['conversion'],
];

/** 같은 역할 그룹에서 먼저 나온 섹션만 남긴다 */
export function dedupeExclusiveRoles(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    const group = EXCLUSIVE_ROLE_GROUPS.find((g) => g.includes(id));
    if (group) {
      const key = `role:${group[0]}`;
      if (seen.has(key)) continue;
      seen.add(key);
    }
    out.push(id);
  }
  return out;
}

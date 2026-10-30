export interface SearchableElement {
  id: string;
  name: string | null;
  keywords?: string;
}

const normalize = (text: string) => text.toLowerCase().replace(/\s+/g, '');

/** 이름이 같으면 0, 이름에 들어 있으면 1, 검색어에만 있으면 2, 없으면 null */
const rank = (item: SearchableElement, query: string) => {
  const name = normalize(item.name ?? '');
  if (name === query) return 0;
  if (name.includes(query)) return 1;
  return item.keywords?.split(/\s+/).some((word) => normalize(word).includes(query)) ? 2 : null;
};

/** 요소 패널 검색 — 이름이 맞는 것부터, 같은 id는 한 번만 */
export const searchElements = <T extends SearchableElement>(items: T[], query: string, limit = 60): T[] => {
  const q = normalize(query);
  if (!q) return [];
  const seen = new Set<string>();
  return items
    .flatMap((item, index) => {
      const score = rank(item, q);
      if (score === null || seen.has(item.id)) return [];
      seen.add(item.id);
      return [{ item, score, index }];
    })
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .slice(0, limit)
    .map(({ item }) => item);
};

/**
 * 스톡 사이트(Pexels·Pixabay)는 영어 검색이 잘 된다.
 * 한글 상품명 그대로 넣으면 과메기처럼 엉뚱한 영상이 나온다.
 */

const STOCK_QUERY_HINTS: { re: RegExp; english: string[] }[] = [
  { re: /과메기/, english: ['gwamegi', 'dried pollack Korea', 'Korean dried fish'] },
  { re: /고등어/, english: ['mackerel fish', 'grilled mackerel'] },
  { re: /갈치/, english: ['hairtail fish', 'cutlassfish'] },
  { re: /꽃게|대게|킹크랩/, english: ['live crab', 'snow crab'] },
  { re: /새우|대하/, english: ['shrimp seafood', 'fresh shrimp'] },
  { re: /전복/, english: ['abalone seafood'] },
  { re: /오징어|문어/, english: ['squid seafood', 'octopus'] },
  { re: /멸치/, english: ['dried anchovy Korea'] },
  { re: /굴/, english: ['oyster seafood'] },
  { re: /사과/, english: ['fresh apple orchard', 'red apple fruit'] },
  { re: /배(?!추)/, english: ['korean pear fruit', 'asian pear'] },
  { re: /딸기/, english: ['fresh strawberry'] },
  { re: /포도/, english: ['fresh grapes vineyard'] },
  { re: /감귤|한라봉|귤|천혜향|레드향/, english: ['tangerine citrus', 'hallabong orange'] },
  { re: /수박/, english: ['watermelon fruit'] },
  { re: /참외|멜론/, english: ['korean melon', 'fresh melon'] },
  { re: /복숭아/, english: ['fresh peach fruit'] },
  { re: /쌀|현미|잡곡/, english: ['uncooked rice grains', 'korean rice'] },
  { re: /꿀|벌꿀/, english: ['honey jar', 'honeycomb'] },
  { re: /한우|소고기/, english: ['korean beef', 'raw beef marble'] },
  { re: /돼지|삼겹/, english: ['pork belly', 'raw pork'] },
  { re: /버섯|표고/, english: ['shiitake mushroom'] },
  { re: /마늘|양파/, english: ['garlic bulbs', 'onion harvest'] },
  { re: /고추|김치/, english: ['korean chili', 'kimchi cabbage'] },
  { re: /녹차/, english: ['green tea leaves'] },
];

const unique = (values: string[]) => [...new Set(values.map((v) => v.trim()).filter(Boolean))];

/** 상품명 → 스톡에 넣을 영어 검색어 1~3개 (앞쪽일수록 더 구체적) */
export function expandStockQuery(raw: string): string[] {
  const trimmed = raw.trim().slice(0, 80);
  if (!trimmed) return [];
  const compact = trimmed.replace(/\s+/g, '');
  const hit = STOCK_QUERY_HINTS.find((rule) => rule.re.test(compact) || rule.re.test(trimmed));
  if (hit) return unique(hit.english).slice(0, 3);
  if (/[가-힣]/.test(trimmed)) return unique([trimmed, 'Korean farm food harvest']).slice(0, 2);
  return [trimmed];
}

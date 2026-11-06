/**
 * 스톡 사이트(Pexels·Pixabay)는 영어 검색이 잘 된다.
 * 한글·모호한 단어(orange=주황/꽃) 그대로 넣으면 패션·꽃 영상이 나온다.
 */

const STOCK_QUERY_HINTS: { re: RegExp; english: string[] }[] = [
  { re: /과메기/, english: ['gwamegi dried fish', 'Korean dried pollack food'] },
  { re: /고등어/, english: ['mackerel fish food', 'grilled mackerel seafood'] },
  { re: /갈치/, english: ['hairtail fish market', 'cutlassfish seafood'] },
  { re: /게장/, english: ['marinated crab korean food', 'soy sauce crab'] },
  { re: /새우|대하/, english: ['fresh shrimp seafood', 'shrimp food market'] },
  { re: /전복/, english: ['abalone seafood food'] },
  { re: /오징어|문어/, english: ['squid seafood food', 'octopus seafood'] },
  { re: /멸치/, english: ['dried anchovy Korean food'] },
  { re: /굴(?!뚝)/, english: ['fresh oyster seafood'] },
  { re: /사과/, english: ['red apple fruit orchard', 'fresh apple harvest farm'] },
  { re: /배(?!추)/, english: ['asian pear fruit', 'korean pear harvest'] },
  { re: /딸기/, english: ['fresh strawberry fruit farm', 'strawberry harvest'] },
  { re: /포도|샤인머스캣/, english: ['fresh grapes vineyard', 'green grape fruit'] },
  { re: /감귤|한라봉|귤|천혜향|레드향/, english: ['tangerine citrus fruit', 'mandarin orange fruit orchard'] },
  // orange 단독 금지 — 꽃·패션·가방이 나온다. 반드시 fruit/citrus/orchard
  { re: /오렌지|orange/i, english: ['navel orange fruit', 'fresh oranges citrus fruit', 'orange orchard harvest'] },
  { re: /수박/, english: ['watermelon fruit farm', 'cutting watermelon'] },
  // 참외 ≠ 캔탈롭/허니듀. 'melon'만 쓰면 외국 멜론이 나온다.
  {
    re: /참외/,
    english: [
      'oriental melon yellow white stripes',
      'chamoe korean yellow striped melon',
      'oblong yellow oriental melon fruit',
    ],
  },
  { re: /멜론/, english: ['cantaloupe melon fruit', 'muskmelon harvest farm'] },
  { re: /홍게|대게/, english: ['red snow crab legs', 'snow crab seafood', 'korean snow crab'] },
  { re: /꽃게/, english: ['blue crab seafood', 'korean swimming crab'] },
  { re: /킹크랩|대게왕/, english: ['king crab legs seafood'] },
  { re: /복숭아/, english: ['fresh peach fruit orchard'] },
  { re: /쌀|현미|잡곡/, english: ['uncooked rice grains farm', 'korean rice harvest'] },
  { re: /꿀|벌꿀/, english: ['honey jar food', 'honeycomb farm'] },
  { re: /한우|소고기/, english: ['korean beef meat food', 'raw beef marble'] },
  { re: /돼지|삼겹/, english: ['pork belly meat food', 'raw pork meat'] },
  { re: /버섯|표고/, english: ['shiitake mushroom farm food'] },
  { re: /마늘|양파/, english: ['garlic bulbs farm', 'onion harvest field'] },
  { re: /고추|김치/, english: ['korean chili farm', 'kimchi cabbage food'] },
  { re: /녹차/, english: ['green tea leaves farm harvest'] },
];

/** 색·패션·다른 품종으로 오인되기 쉬운 영어 — 단독 검색 금지 */
const AMBIGUOUS_EN = /^(orange|apple|date|jam|ginger|mint|pepper|bean|salmon|coral|cream|navy|olive|melon|pear)$/i;

export type ProduceIdentity = {
  /** 이 품목으로 검색할 영어 (외국 유사종 단어 금지) */
  queries: string[];
  /** 제목·URL에 있으면 다른 품종이라 탈락 */
  reject: RegExp;
  /** AI 이미지에 넣을 생김새 */
  look: string;
};

const PRODUCE_IDS: { re: RegExp; id: ProduceIdentity }[] = [
  {
    re: /홍게|대게/,
    id: {
      queries: ['red snow crab legs', 'snow crab seafood', 'korean snow crab'],
      reject: /tuna|bluefin|octopus|pastry|cake|dessert|donut|bread|shrimp|prawn|lobster|salmon|oyster|squid|beef|pork|chicken/i,
      look: 'Korean red snow crab (홍게, Chionoecetes) with long legs and a spiny shell. NOT lobster, NOT tuna, NOT octopus, NOT shrimp.',
    },
  },
  {
    re: /꽃게/,
    id: {
      queries: ['blue crab seafood', 'korean swimming crab'],
      reject: /tuna|bluefin|octopus|pastry|cake|lobster|shrimp|snow crab/i,
      look: 'Korean blue swimming crab (꽃게), wide flat shell. NOT snow crab, NOT lobster.',
    },
  },
  {
    re: /참외/,
    id: {
      queries: [
        'oriental melon yellow white stripes',
        'chamoe oblong yellow melon',
        'korean chamoe fruit striped',
      ],
      reject: /cantaloupe|honeydew|muskmelon|rockmelon|galia|netted melon|watermelon/i,
      look: 'oblong bright-yellow Korean oriental melon (chamoe) with white longitudinal stripes and pale white flesh. NOT cantaloupe, NOT honeydew, NOT round netted muskmelon.',
    },
  },
  {
    re: /멜론/,
    id: {
      queries: ['cantaloupe melon fruit', 'muskmelon sliced fruit'],
      reject: /chamoe|oriental melon|korean melon/i,
      look: 'netted cantaloupe muskmelon, orange flesh. NOT Korean chamoe.',
    },
  },
  {
    re: /배(?!추)/,
    id: {
      queries: ['asian pear fruit', 'korean pear nashi fruit'],
      reject: /\b(bosc|bartlett|anjou)\b/i,
      look: 'round golden-brown Asian pear (nashi), crisp white flesh. NOT a European tapered pear.',
    },
  },
  {
    re: /감귤|한라봉|귤|천혜향|레드향/,
    id: {
      queries: ['mandarin orange fruit', 'tangerine citrus orchard'],
      reject: /\b(navel orange|blood orange)\b/i,
      look: 'small Korean mandarin tangerine, easy-peel skin. NOT a large navel orange.',
    },
  },
];

export function produceIdentity(name: string): ProduceIdentity | null {
  const compact = name.replace(/\s+/g, '');
  return PRODUCE_IDS.find((p) => p.re.test(compact) || p.re.test(name))?.id ?? null;
}

export type ProducePlace = 'sea' | 'meat' | 'farm';

/**
 * 화면이 나와야 할 장소. 상품 카테고리가 잘못 저장돼 있어도 이름(홍게 등)을 먼저 본다.
 * 수산물은 배·어시장·손질대, 육류는 정육, 그 외는 밭·과수원.
 */
export function producePlace(name: string, category = ''): ProducePlace {
  const blob = `${name} ${category}`;
  if (
    /홍게|대게|꽃게|킹크랩|새우|전복|오징어|문어|굴|고등어|갈치|광어|연어|멸치|조개|수산|해산|어패|생선|게/.test(blob) ||
    /crab|seafood|shrimp|abalone|oyster|squid|octopus|snow crab/i.test(blob)
  ) {
    return 'sea';
  }
  if (/한우|소고기|돼지|삼겹|닭고기|축산|육류/.test(blob) || /\b(beef|pork belly|chicken)\b/i.test(blob)) return 'meat';
  return 'farm';
}

/** 한글 품목과 안 맞는 영어 검색어면 true (예: 참외인데 melon) */
export function isUnsafeEnglishFor(koName: string, en: string): boolean {
  const id = produceIdentity(koName);
  if (!id) return AMBIGUOUS_EN.test(en.trim());
  if (id.reject.test(en)) return true;
  if (/참외/.test(koName) && /\bmelon\b/i.test(en) && !/oriental|chamoe|striped/i.test(en)) return true;
  return false;
}

/** 제목·URL이 상품과 다른 음식(참치·빵 등)이면 true */
const OTHER_FOOD: { bad: RegExp; ok: RegExp }[] = [
  { bad: /tuna|bluefin|참치/, ok: /참치/ },
  { bad: /octopus|문어/, ok: /문어/ },
  { bad: /pastry|cake|dessert|donut|빵|과자|케이크/, ok: /빵|과자|디저트|케이크/ },
  { bad: /shrimp|prawn|새우/, ok: /새우/ },
  { bad: /lobster|랍스터/, ok: /랍스터/ },
  { bad: /salmon|연어/, ok: /연어/ },
  { bad: /oyster|굴(?!비)/, ok: /굴/ },
  { bad: /squid|오징어/, ok: /오징어/ },
];

export function mentionsWrongFood(productName: string, blob: string): boolean {
  if (rejectsProduce(productName, blob)) return true;
  const name = productName.replace(/\s+/g, '');
  return OTHER_FOOD.some((rule) => rule.bad.test(blob) && !rule.ok.test(name));
}

/** 스톡/CC 제목·URL이 다른 품종이면 true */
export function rejectsProduce(productName: string, blob: string): boolean {
  const id = produceIdentity(productName);
  if (!id) return false;
  if (id.reject.test(blob)) return true;
  // 참외인데 제목·URL이 그냥 melon이면 캔탈롭/허니듀로 본다.
  // oriental·chamoe·stripe·korean 이 같이 있을 때만 통과.
  if (/참외/.test(productName.replace(/\s+/g, ''))) {
    const mentionsMelon = /\bmelons?\b|cantaloupe|honeydew|muskmelon/i.test(blob);
    const isChamoe = /oriental|chamoe|stripe|korean/i.test(blob);
    if (mentionsMelon && !isChamoe) return true;
  }
  return false;
}

const unique = (values: string[]) => [...new Set(values.map((v) => v.trim()).filter(Boolean))];

/** 상품명 → 스톡에 넣을 영어 검색어 1~3개 (앞쪽일수록 더 구체적, 반드시 식품 맥락) */
export function expandStockQuery(raw: string): string[] {
  const trimmed = raw.trim().slice(0, 80);
  if (!trimmed) return [];
  const compact = trimmed.replace(/\s+/g, '');
  const hit = STOCK_QUERY_HINTS.find((rule) => rule.re.test(compact) || rule.re.test(trimmed));
  if (hit) {
    // 이미 'navel orange fruit orchard'처럼 식품 문장이면 매핑으로 덮어쓰지 않는다
    const words = trimmed.split(/\s+/).length;
    if (words >= 3 && /\b(fruit|food|farm|orchard|harvest|seafood|eating|cutting|produce|citrus)\b/i.test(trimmed)) {
      return [trimmed];
    }
    return unique(hit.english).slice(0, 3);
  }
  if (AMBIGUOUS_EN.test(trimmed)) {
    return unique([`${trimmed} fruit food`, `${trimmed} farm harvest`, `fresh ${trimmed} produce`]).slice(0, 3);
  }
  if (/[가-힣]/.test(trimmed)) {
    // 매핑 없는 한글은 한글 검색 대신 농식품 일반어 (한글은 스톡에 거의 없음)
    return ['Korean farm produce harvest', 'fresh market fruit vegetable'];
  }
  // 이미 영어 문장이면 fruit/food/farm이 없으면 붙인다
  if (!/\b(fruit|food|farm|orchard|harvest|seafood|fish|meat|vegetable|produce|citrus)\b/i.test(trimmed)) {
    return unique([`${trimmed} fresh food`, `${trimmed} farm produce`]).slice(0, 2);
  }
  return [trimmed];
}

export function isAmbiguousStockTerm(term: string): boolean {
  return AMBIGUOUS_EN.test(term.trim());
}

/** 꽃·패션·인테리어가 섞이기 쉬운 스톡 검색에 붙이는 제외어 (사이트마다 무시될 수 있음) */
const STOCK_NEG = '-flower -bouquet -fashion -handbag -perfume -interior';

/** 장면 유형 → 농수산물 숏폼에 맞는 동작 검색어 (패션·인테리어 금지) */
export function farmShotQueries(productEn: string, shot: string, category?: string): string[] {
  const p = productEn.replace(/\s+/g, ' ').trim() || 'fresh produce';
  const where = producePlace(`${productEn} ${category || ''}`, category);
  const place = where === 'sea' ? 'fish market harbor boat' : where === 'meat' ? 'butcher shop' : 'orchard farm';
  const eat = where === 'sea' ? 'seafood meal chopsticks' : where === 'meat' ? 'grilled meat eating' : 'fruit eating';
  const cut = where === 'sea' ? 'cleaning crab legs knife' : where === 'meat' ? 'slicing meat board' : 'cutting fruit knife';
  const originQ =
    where === 'sea'
      ? [`${p} fishing boat deck ${STOCK_NEG}`, `${p} fish market stall ${STOCK_NEG}`, `${p} on ice seafood ${STOCK_NEG}`]
      : where === 'meat'
        ? [`${p} butcher shop ${STOCK_NEG}`, `${p} meat counter ${STOCK_NEG}`]
        : [`${p} ${place} harvest ${STOCK_NEG}`, `farmer picking ${p} ${STOCK_NEG}`, `${p} farm field morning ${STOCK_NEG}`];
  const map: Record<string, string[]> = {
    origin: originQ,
    crave: [
      `person eating ${p} ${eat} ${STOCK_NEG}`,
      `biting ${p} food ${STOCK_NEG}`,
      `${p} tasting food closeup ${STOCK_NEG}`,
    ],
    hook: [`${cut} ${p} ${STOCK_NEG}`, `${p} cut open fresh food ${STOCK_NEG}`, `slicing ${p} on board ${STOCK_NEG}`],
    detail: [
      `${p} close up food texture ${STOCK_NEG}`,
      `macro fresh ${p} food ${STOCK_NEG}`,
      `${p} water droplets produce ${STOCK_NEG}`,
    ],
    hero: [
      `${p} crate market display ${STOCK_NEG}`,
      `fresh ${p} basket farm ${STOCK_NEG}`,
      `${p} piled produce stall ${STOCK_NEG}`,
    ],
    hold: [
      `hands holding ${p} food ${STOCK_NEG}`,
      `farmer hands ${p} ${STOCK_NEG}`,
      `showing ${p} to camera food ${STOCK_NEG}`,
    ],
    pack: [
      `packing ${p} produce box ${STOCK_NEG}`,
      `${p} cardboard shipping produce ${STOCK_NEG}`,
      `boxing fresh ${p} ${STOCK_NEG}`,
    ],
    store: [
      `${p} in refrigerator food ${STOCK_NEG}`,
      `fridge fresh produce ${p} ${STOCK_NEG}`,
      `kitchen storing ${p} food ${STOCK_NEG}`,
    ],
    prep: [
      `cutting board ${p} knife food ${STOCK_NEG}`,
      `preparing ${p} kitchen food ${STOCK_NEG}`,
      `peeling preparing ${p} ${STOCK_NEG}`,
    ],
    product: [`fresh ${p} food produce ${STOCK_NEG}`, `${p} market stall ${STOCK_NEG}`],
    photo: [`fresh ${p} food produce ${STOCK_NEG}`],
  };
  return map[shot] || map.hero!;
}

/**
 * 스톡 결과 URL·작가명에 꽃/패션 신호가 있으면 거른다.
 * (제목이 없을 때 썸네일·페이지 URL 휴리스틱)
 */
export function looksIrrelevantStock(meta: { author?: string; pageUrl?: string; thumbnail?: string }): boolean {
  const blob = `${meta.author || ''} ${meta.pageUrl || ''} ${meta.thumbnail || ''}`.toLowerCase();
  return /flower|bouquet|daisy|gerbera|fashion|handbag|purse|perfume|makeup|lipstick|nail-polish|interior-design|furniture/.test(
    blob,
  );
}

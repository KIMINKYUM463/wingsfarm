/**
 * 상품명·상세 문구·원산지 표기를 규칙으로 점검한다 (AI 미사용·요금 없음). 옵션명 만들기가 쓴다.
 * 근거: 식품표시광고법 제8조(효능·질병 표현), 표시광고법 제3조(거짓·과장), 원산지표시법 제5·6조,
 * 마켓 상품명 정책(배송·할인 문구), 한국소비자원 2026 과일 선물세트 조사(크기·당도·등급 모호 표현).
 * 사전에 걸린다고 모두 위법은 아니고, 안 걸린다고 안전한 것도 아니다 — 최종 판단은 판매자 몫.
 */

export type Severity = "danger" | "warn" | "info";
export type CheckField = "title" | "body" | "origin";

export interface Finding {
  id: string;
  severity: Severity;
  field: CheckField;
  /** 문제된 표현 (없으면 전체에 대한 지적) */
  match: string;
  index: number;
  message: string;
  fix: string;
  basis: string;
}

export interface CheckInput {
  title: string;
  body: string;
  /** 판매자가 표시할 원산지 (예: 국내산(경북 성주군)) */
  origin: string;
}

interface PatternRule {
  id: string;
  severity: Severity;
  fields: CheckField[];
  pattern: RegExp;
  message: string;
  fix: string;
  basis: string;
  /** true를 돌려주면 이 규칙을 건너뛴다 (예: Brix 수치가 이미 있음) */
  skipIf?: (all: string) => boolean;
}

const HAS_BRIX = /\d+(?:\.\d+)?\s?(?:brix|브릭스|bx)/i;
const HAS_SIZE = /\d+\s?(?:g\b|그램|과|입|미)/i;
const COUNTRIES = /칠레|미국|호주|뉴질랜드|중국|베트남|태국|필리핀|페루|멕시코|노르웨이|러시아|일본|대만|스페인|이탈리아|캐나다|남아공|남아프리카|인도네시아|에콰도르|과테말라|콜롬비아|브라질|아르헨티나|터키|튀르키예|이스라엘|모로코|이집트|인도|파키스탄|몽골|캄보디아|미얀마|말레이시아|프랑스|독일|네덜란드|덴마크|영국|아일랜드|아이슬란드|그린란드|모리타니|세네갈/;

const RULES: PatternRule[] = [
  {
    id: "efficacy",
    severity: "danger",
    fields: ["title", "body"],
    pattern:
      /치료|완치|특효|즉효|만병통치|약효|보약|항암|(?<!파손|변질|눌림|파손\s|변질\s|눌림\s)예방|면역력?|혈압|혈당|당뇨|고지혈|콜레스테롤|다이어트|살\s?빠|체지방|디톡스|해독|염증|관절|노화\s?방지|피부\s?미용|숙취\s?해소|변비|원기\s?회복|정력/g,
    message: "질병 예방·치료나 효능으로 오인될 표현",
    fix: "효능 대신 맛·식감·산지·수확 시기로 표현하세요. 영양성분은 공인 시험성적서가 있을 때 수치로만.",
    basis: "식품표시광고법 제8조 (위반 시 영업정지·형사처벌)",
  },
  {
    id: "superlative",
    severity: "warn",
    fields: ["title", "body"],
    pattern: /최고|최상(?!품)|최초|최강|최대(?!\s?\d)|1\s?위|일등|넘버\s?원|no\.?\s?1|100\s?%|국내\s?유일|유일|완벽|세계\s?최|전국\s?최|극강/gi,
    message: "근거 없는 최상급·비교 표현",
    fix: "객관적 근거(수상·인증·시험성적)가 없으면 빼고, 있으면 출처·기간을 함께 적으세요.",
    basis: "표시광고법 제3조 (거짓·과장 광고)",
  },
  {
    id: "title-policy",
    severity: "warn",
    fields: ["title"],
    pattern: /무료\s?배송|무배|당일\s?(?:배송|발송|출고)|빠른\s?배송|총알\s?배송|특가|할인|세일|sale|이벤트|1\s?\+\s?1|사은품|증정|최저가|쿠폰/gi,
    message: "상품명에 넣으면 안 되는 배송·할인 문구",
    fix: "배송비·할인·사은품은 상품명이 아니라 배송·혜택 설정 칸에 입력하세요.",
    basis: "스마트스토어·쿠팡 상품명 정책 (검색 제한·수정 요청)",
  },
  {
    id: "brix",
    severity: "warn",
    fields: ["title", "body"],
    pattern: /초?고당도|당도\s?선별|꿀\s?당도|당도\s?보장|당도\s?최상/g,
    message: "당도 수치 없는 '고당도' 표현",
    fix: "선별 기준을 '13Brix 이상 선별'처럼 수치로 적으세요.",
    basis: "한국소비자원 2026 과일 선물세트 조사 (45%가 Brix 미표기로 개선 권고)",
    skipIf: (all) => HAS_BRIX.test(all),
  },
  {
    id: "size",
    severity: "warn",
    fields: ["title", "body"],
    pattern: /특대과|중대과|대과|중과|소과|로얄과|왕특|특대|대왕/g,
    message: "크기 기준 없는 '대과·특대' 표현",
    fix: "개당 중량(예: 개당 250~300g)이나 과수(예: 5kg 16~18과)를 함께 적으세요.",
    basis: "한국소비자원 2026 조사 (같은 '대과' 세트 안에서도 1.7배 중량 차이)",
    skipIf: (all) => HAS_SIZE.test(all),
  },
  {
    id: "grade",
    severity: "warn",
    fields: ["title", "body"],
    pattern: /특상품|최상품|특품|특급|프리미엄급|[AS]\+?급/g,
    message: "기준이 없는 등급 표현",
    fix: "농산물 표준규격 등급(특·상·보통)을 쓰거나, 자체 기준(크기·당도·흠집)을 함께 적으세요.",
    basis: "농산물품질관리법 표준규격 · 한국소비자원 2026 조사",
  },
  {
    id: "vague-origin",
    severity: "danger",
    fields: ["title", "body"],
    pattern: /유명\s?산지|명품\s?산지|최고\s?산지/g,
    message: "산지를 숨기는 모호한 표현",
    fix: "실제 시·군명(예: 경북 청송군)을 적으세요.",
    basis: "원산지표시법 제6조 (혼동 우려 표시 금지)",
  },
  {
    id: "low-pesticide",
    severity: "danger",
    fields: ["title", "body"],
    pattern: /저농약/g,
    message: "폐지된 '저농약' 인증 표시",
    fix: "저농약 인증은 2016년 폐지돼 쓸 수 없어요. 무농약·유기농 인증이 있으면 인증번호와 함께 적으세요.",
    basis: "친환경농어업법",
  },
  {
    id: "certification",
    severity: "warn",
    fields: ["title", "body"],
    pattern: /유기농|무농약|친환경|무항생제|GAP|우수관리|HACCP|해썹/gi,
    message: "인증 표시 — 인증번호 확인 필요",
    fix: "인증서를 받은 상품만 쓰고, 인증번호·인증기관을 상세에 함께 적으세요.",
    basis: "친환경농어업법·농산물품질관리법 (미인증 표시는 형사처벌)",
  },
  {
    id: "natural",
    severity: "warn",
    fields: ["title", "body"],
    pattern: /천연|무첨가|무방부제|자연산/g,
    message: "근거가 필요한 '천연·무첨가·자연산' 표현",
    fix: "가공식품의 무첨가 표시는 식약처 기준을 따르고, 수산물 '자연산'은 양식이 아니라는 근거를 갖추세요.",
    basis: "식품표시광고법 제8조 · 표시광고법 제3조",
  },
];

/** 상품명·원산지 대조용 주요 산지 (시·군·지역 브랜드) */
const REGIONS = [
  "성주", "청송", "영주", "의성", "안동", "상주", "문경", "예천", "봉화", "영양", "영덕", "울진", "포항", "구룡포", "경산", "영천", "청도", "김천", "고령",
  "밀양", "산청", "함양", "거창", "하동", "남해", "거제", "통영", "진영", "대저", "기장",
  "나주", "해남", "영암", "무안", "신안", "완도", "진도", "고흥", "보성", "벌교", "순천", "광양", "구례", "담양", "곡성", "장흥", "여수",
  "고창", "부안", "김제", "익산", "군산", "정읍", "순창", "임실", "진안", "무주", "장수",
  "영동", "충주", "괴산", "음성", "부여", "논산", "서산", "태안", "당진", "홍성", "금산", "청양",
  "이천", "여주", "평택", "가평", "철원", "평창", "강릉", "횡성", "정선", "양구", "홍천", "속초", "삼척",
  "제주", "서귀포",
];

const TITLE_LIMIT = 50;
const EMOJI = /\p{Extended_Pictographic}|[★☆♥♡◆◇■□▶◀※♣♠●○◎♪✔✅]/u;

function patternFindings(input: CheckInput): Finding[] {
  const all = `${input.title}\n${input.body}`;
  const findings: Finding[] = [];
  for (const rule of RULES) {
    if (rule.skipIf?.(all)) continue;
    for (const field of rule.fields) {
      const text = input[field];
      for (const m of text.matchAll(new RegExp(rule.pattern.source, rule.pattern.flags))) {
        findings.push({ id: rule.id, severity: rule.severity, field, match: m[0], index: m.index ?? 0, message: rule.message, fix: rule.fix, basis: rule.basis });
      }
    }
  }
  return findings;
}

function titleFormatFindings(title: string): Finding[] {
  const findings: Finding[] = [];
  const base = { field: "title" as const, index: 0, basis: "마켓 상품명 가이드 (검색 품질)" };
  const length = [...title].length;
  if (length > TITLE_LIMIT) {
    findings.push({ ...base, id: "length", severity: length > 100 ? "danger" : "warn", match: "", message: `상품명이 ${length}자로 길어요 (권장 ${TITLE_LIMIT}자 이내)`, fix: "핵심 키워드 + 산지 + 중량 순으로 줄이세요." });
  }
  const emoji = title.match(EMOJI);
  if (emoji) findings.push({ ...base, id: "emoji", severity: "warn", match: emoji[0], index: emoji.index ?? 0, message: "특수문자·이모지", fix: "상품명에는 특수문자·이모지를 빼세요 (검색 노출 저하)." });

  const words = title.split(/[\s,/[\]()]+/).filter((w) => [...w].length >= 2);
  const repeated = [...new Set(words.filter((w, i) => words.indexOf(w) !== i))];
  for (const word of repeated) {
    findings.push({ ...base, id: "repeat", severity: "warn", match: word, index: title.indexOf(word), message: `같은 단어 반복: ${word}`, fix: "같은 키워드를 반복하면 어뷰징으로 보일 수 있어요. 한 번만 쓰세요." });
  }
  return findings;
}

function originFindings(input: CheckInput): Finding[] {
  const origin = input.origin.trim();
  const base = { field: "origin" as const, index: 0, basis: "원산지표시법 제5·6조" };
  if (!origin) {
    return [{ ...base, id: "origin-missing", severity: "danger", match: "", message: "원산지 표기를 입력하지 않았어요", fix: "상품명·가격 근처에 상품명과 같은 크기 이상으로 원산지를 표시해야 해요 (미표시 1천만 원 이하 과태료)." }];
  }
  const findings: Finding[] = [];
  if (/수입|외국|외산/.test(origin) && !COUNTRIES.test(origin)) {
    findings.push({ ...base, id: "origin-country", severity: "danger", match: origin, message: "수입품인데 나라 이름이 없어요", fix: "'수입산' 대신 '칠레산', '미국산'처럼 국가명을 적으세요." });
  }
  const titleRegions = REGIONS.filter((r) => input.title.includes(r));
  const originRegions = REGIONS.filter((r) => origin.includes(r));
  for (const region of titleRegions) {
    if (originRegions.length > 0 && !originRegions.includes(region)) {
      findings.push({ ...base, id: "origin-mismatch", severity: "danger", match: region, message: `상품명의 산지 '${region}'와 원산지 표기(${originRegions.join(", ")})가 달라요`, fix: "실제 산지로 통일하세요. 거짓·혼동 표시는 7년 이하 징역 또는 1억 원 이하 벌금 대상이에요." });
    } else if (originRegions.length === 0) {
      findings.push({ ...base, id: "origin-vague", severity: "info", match: region, message: `상품명에 '${region}'를 썼는데 원산지에는 지역이 없어요`, fix: `원산지도 '국내산(${region})'처럼 시·군까지 적어 일치시키세요.` });
    }
  }
  if (/^(국내산|국산)$/.test(origin) && titleRegions.length === 0) {
    findings.push({ ...base, id: "origin-region", severity: "info", match: origin, message: "원산지가 '국내산'만 있어요", fix: "시·도나 시·군까지 적으면 신뢰도가 올라가요 (예: 국내산(경북 청송군))." });
  }
  return findings;
}

const SEVERITY_ORDER: Record<Severity, number> = { danger: 0, warn: 1, info: 2 };

export function checkListing(input: CheckInput): Finding[] {
  return [...originFindings(input), ...patternFindings(input), ...(input.title.trim() ? titleFormatFindings(input.title) : [])].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
  );
}

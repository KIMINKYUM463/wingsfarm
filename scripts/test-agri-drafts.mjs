/**
 * 농수산물 초안 20종 — 사진 없이 구성·기획을 돌리고 세일즈 구조·카피를 채점한다.
 * 사용: node scripts/test-agri-drafts.mjs
 */
const BASE = process.env.DRAFT_TEST_BASE || 'http://localhost:3000/api/lever/functions/v1';
const PLAN_LIMIT = Number(process.env.DRAFT_TEST_PLANS || 20);
const COMPOSE_CONCURRENCY = 3;
const PLAN_CONCURRENCY = 2;

const PRODUCTS = [
  {
    productName: '충주 햇사과 5kg',
    brandName: '충주과원',
    features: '당도 14브릭스 전후, 흠과 제외 선별, 과수원에서 직접 수확해 보냄',
    sizeInfo: '한 알 280~320g, 5kg 상자 약 16과',
    sensory: '아삭하고 단맛이 먼저 올라오고 신맛은 약해요',
    origin: '충북 충주 산척면',
    harvest: '9월 하순~10월 중순 수확',
    selection: '당도 측정 후 14브릭스 이상, 상처·변형과 제외',
    producerStory: '부부가 20년째 후지·홍로를 키워요. 수확 당일 선별해 보냅니다.',
    options: [
      { name: '5kg 중과', spec: '한 알 280g 전후 16과' },
      { name: '5kg 대과', spec: '한 알 330g 전후 14과' },
    ],
    reviewsText: '아삭하고 달아서 아이들 간식으로 재구매했어요\n선물용으로 보냈더니 크기도 고르다고 했어요',
    salesRecord: '스마트스토어 이번 시즌 1,200상자',
    shipping: '주문 다음날 출고, 제주·산간은 1일 추가',
    contact: '010-1111-2222, 평일 9~18시',
    promotion: '',
    certifications: [{ name: 'GAP', number: 'GAP-2024-001' }],
    gift: false,
  },
  {
    productName: '서귀포 한라봉 3kg',
    brandName: '한남과수원',
    features: '당도 13브릭스 이상, 껍질 얇고 과즙 많음, 나무에서 완숙 후 수확',
    sizeInfo: '한 알 250g 전후, 3kg 약 12과',
    sensory: '과즙이 많고 달콤한데 끝맛이 상큼해요',
    origin: '제주 서귀포시 남원읍',
    harvest: '2월~3월 출하',
    selection: '13브릭스 미만·쪼그라든 과 제외',
    producerStory: '해풍 맞는 과수원에서 부자가 함께 키워요.',
    options: [{ name: '3kg', spec: '12과 전후' }],
    reviewsText: '선물했는데 달다고 전화 왔어요',
    salesRecord: '지난 시즌 800상자',
    shipping: '화·금 출고',
    contact: '064-000-1111',
    certifications: [],
    gift: true,
  },
  {
    productName: '고창 수박 1통',
    brandName: '선운농원',
    features: '고창 황토밭, 8kg 전후 대과, 당도 11브릭스 이상',
    sizeInfo: '한 통 7.5~8.5kg',
    sensory: '과육이 아삭하고 물이 많아요',
    origin: '전북 고창군',
    harvest: '7월 제철',
    selection: '두드렸을 때 맑은 소리, 꼭지 싱싱한 것만',
    producerStory: '황토밭에서 30년째 수박만 키워요.',
    options: [{ name: '특과 1통', spec: '8kg 전후' }],
    reviewsText: '씨가 적고 달아서 한 통이 금방 없어졌어요',
    salesRecord: '',
    shipping: '수확 다음날 출고, 아이스팩 동봉',
    contact: '063-000-2222',
    certifications: [],
    gift: false,
  },
  {
    productName: '논산 설향 딸기 500g',
    brandName: '논산베리',
    features: '설향 품종, 당일 수확, 중과 위주 선별',
    sizeInfo: '팩 500g, 한 알 15~20g',
    sensory: '향이 진하고 과육이 부드러워요',
    origin: '충남 논산시 연무읍',
    harvest: '12월~4월, 오전에 수확',
    selection: '꼭지 시든 것·짓눌린 알 제외',
    producerStory: '하우스 온도를 낮춰 천천히 익혀요.',
    options: [
      { name: '500g', spec: '중과' },
      { name: '1kg', spec: '중과 2팩' },
    ],
    reviewsText: '향이 진짜 딸기예요. 하루 만에 다 먹었어요',
    salesRecord: '이번 달 3,000팩',
    shipping: '당일 수확 당일 출고, 아이스박스',
    contact: '041-000-3333',
    certifications: [{ name: '무농약', number: 'ORG-11-2025' }],
    gift: false,
  },
  {
    productName: '제주 노지감귤 5kg',
    brandName: '효돈감귤',
    features: '노지 온주밀감, 당산비 균형, 작은 과 위주',
    sizeInfo: '2S~S과, 5kg 약 45과',
    sensory: '껍질 얇고 새콤달콤해요',
    origin: '제주 서귀포 효돈',
    harvest: '11월 중순~12월',
    selection: '썩은 과·너무 푸른 과 제외',
    producerStory: '할아버지 대부터 노지만 키워요.',
    options: [{ name: '5kg 소과', spec: '2S~S' }],
    reviewsText: '아이들이 껍질째 까먹기 좋아요',
    salesRecord: '',
    shipping: '주 3회 출고',
    contact: '064-000-4444',
    certifications: [],
    gift: false,
  },
  {
    productName: '청양 청양고추 1kg',
    brandName: '칠갑농가',
    features: '청양 재래 고추, 매운맛 균일, 당일 수확',
    sizeInfo: '1kg, 길이 7~9cm',
    sensory: '향이 강하고 끝이 매우 매워요',
    origin: '충남 청양군',
    harvest: '7월~9월',
    selection: '시든 꼭지·무른 것 제외',
    producerStory: '청양에서 태어난 고추만 심어요.',
    options: [{ name: '1kg', spec: '생고추' }],
    reviewsText: '찌개에 넣으니 향이 확 올라와요',
    salesRecord: '',
    shipping: '수확 당일 출고',
    contact: '041-000-5555',
    certifications: [],
    gift: false,
  },
  {
    productName: '해남 호박고구마 3kg',
    brandName: '땅끝농원',
    features: '호박고구마, 해남 황토, 세척 후 발송',
    sizeInfo: '중·대 혼합 3kg, 한 개 150~250g',
    sensory: '찌면 밤처럼 포슬하고 달아요',
    origin: '전남 해남군',
    harvest: '10월 수확, 저장 후 출하',
    selection: '상처·초록 빛 제외, 중과 위주',
    producerStory: '황토밭을 돌아가며 심어 지력을 쉬게 해요.',
    options: [{ name: '3kg 중과', spec: '150~250g' }],
    reviewsText: '찌면 꿀고구마처럼 달아요',
    salesRecord: '재구매율 38%',
    shipping: '주 2회 출고',
    contact: '061-000-6666',
    certifications: [],
    gift: false,
  },
  {
    productName: '안동 마 2kg',
    brandName: '풍산마농장',
    features: '안동 마, 흙 털고 보내요, 껍질째 보관',
    sizeInfo: '2kg, 뿌리 굵기 3~5cm',
    sensory: '갈으면 끈기가 좋아요',
    origin: '경북 안동시 풍산',
    harvest: '11월 수확',
    selection: '갈라진 뿌리 제외',
    producerStory: '모래흙에서 곧게 키워요.',
    options: [{ name: '2kg', spec: '흙마' }],
    reviewsText: '갈아서 우유에 타 먹으니 고소해요',
    salesRecord: '',
    shipping: '주문 후 2일 내 출고',
    contact: '054-000-7777',
    certifications: [],
    gift: false,
  },
  {
    productName: '완도 자른미역 200g',
    brandName: '청완수산',
    features: '완도 바다 자연 미역, 햇볕 건조, 자른 미역',
    sizeInfo: '200g, 물에 불리면 약 1.2kg',
    sensory: '불리면 두껍고 향이 바다 내음이에요',
    origin: '전남 완도군',
    harvest: '2월~4월 채취',
    selection: '이물질·뿌리 제거 후 건조',
    producerStory: '부부가 배 타고 채취해요.',
    options: [{ name: '200g', spec: '자른 미역' }],
    reviewsText: '국물이 시원하고 미역이 질기지 않아요',
    salesRecord: '누적 5,000봉',
    shipping: '주문 다음날 출고',
    contact: '061-000-8888',
    certifications: [],
    gift: false,
  },
  {
    productName: '여수 생굴 1kg',
    brandName: '돌산굴',
    features: '여수 돌산 생굴, 깐 굴, 당일 작업',
    sizeInfo: '1kg, 알당 12~18g',
    sensory: '알이 통통하고 비린내가 적어요',
    origin: '전남 여수 돌산',
    harvest: '11월~3월',
    selection: '깨진 알·이물질 제외',
    producerStory: '아침 작업 후 바로 보냅니다.',
    options: [{ name: '1kg', spec: '깐 생굴' }],
    reviewsText: '초장만 찍어도 달아요. 비린내 없어요',
    salesRecord: '',
    shipping: '월·수·금 출고, 아이스박스+아이스팩',
    contact: '061-000-9999',
    certifications: [{ name: '해역 수질 적합', number: 'YS-2025-11' }],
    gift: false,
  },
  {
    productName: '포항 과메기 10마리',
    brandName: '구룡포바다',
    features: '구룡포 청어 과메기, 자연 해풍 건조 3일',
    sizeInfo: '10마리, 한 마리 손질 후 약 80g',
    sensory: '기름기가 있고 비리지 않아요',
    origin: '경북 포항 구룡포',
    harvest: '11월~1월 건조',
    selection: '덜 마른 것·탄 것 제외',
    producerStory: '3대째 덕장에서 말려요.',
    options: [{ name: '10마리', spec: '손질 과메기' }],
    reviewsText: '미역·마늘에 싸 먹으니 고소해요',
    salesRecord: '겨울 시즌 2,000팩',
    shipping: '냉동 아이스박스',
    contact: '054-000-1010',
    certifications: [],
    gift: true,
  },
  {
    productName: '제주 은갈치 3마리',
    brandName: '한림수산',
    features: '제주 은갈치, 배에서 바로 손질, 급냉',
    sizeInfo: '한 마리 손질 후 250g 전후, 3마리',
    sensory: '살이 희고 가시가 적어 구워 먹기 좋아요',
    origin: '제주 한림',
    harvest: '가을 조업분',
    selection: '배 찢어진 것 제외',
    producerStory: '위판 직후 손질해 급냉해요.',
    options: [{ name: '3마리', spec: '중갈치' }],
    reviewsText: '가시가 적어 아이도 먹었어요',
    salesRecord: '',
    shipping: '냉동 발송, 월·목 출고',
    contact: '064-000-1212',
    certifications: [],
    gift: false,
  },
  {
    productName: '서산 육쪽마늘 1kg',
    brandName: '간월농장',
    features: '서산 육쪽마늘, 한지형, 껍질째 건조',
    sizeInfo: '1kg, 통마늘 지름 4~5cm',
    sensory: '알이 단단하고 매운 향이 진해요',
    origin: '충남 서산시 고북면',
    harvest: '6월 수확 후 건조',
    selection: '벌마늘·무른 쪽 제외',
    producerStory: '간척지 가까이 밭에서 키워요.',
    options: [{ name: '1kg', spec: '통마늘' }],
    reviewsText: '다지면 향이 세고 저장도 잘 돼요',
    salesRecord: '',
    shipping: '주문 후 1~2일 출고',
    contact: '041-000-1313',
    certifications: [],
    gift: false,
  },
  {
    productName: '부여 밤 2kg',
    brandName: '규암밤농원',
    features: '부여 옥광밤, 알이 크고 속껍질이 잘 벗겨져요',
    sizeInfo: '2kg, 특대 알',
    sensory: '쪄 먹으면 달고 밤 향이 진해요',
    origin: '충남 부여군 규암면',
    harvest: '9월 하순~10월',
    selection: '벌레 구멍·쪼개진 알 제외',
    producerStory: '밤나무 아래를 매일 쓸어 주워요.',
    options: [{ name: '2kg 특대', spec: '옥광' }],
    reviewsText: '쪄서 아이 간식으로 딱이에요',
    salesRecord: '',
    shipping: '수확기 주 3회 출고',
    contact: '041-000-1414',
    certifications: [],
    gift: true,
  },
  {
    productName: '양양 송이버섯 200g',
    brandName: '설악송이',
    features: '양양 자연산 송이, 1등급 위주, 당일 채취',
    sizeInfo: '200g, 길이 8cm 전후 4~6송이',
    sensory: '솔향이 진하고 식감이 아삭해요',
    origin: '강원 양양군',
    harvest: '9월 중순~10월 초',
    selection: '벌레 먹은 것·펴진 갓 제외',
    producerStory: '설악 자락 소나무밭에서 새벽에 줍습니다.',
    options: [{ name: '200g 1등급', spec: '4~6송이' }],
    reviewsText: '향이 집 안에 퍼져요. 구워 먹으니 고소해요',
    salesRecord: '',
    shipping: '당일 채취 당일 출고, 냉장',
    contact: '033-000-1515',
    certifications: [],
    gift: true,
  },
  {
    productName: '강화 순무 3kg',
    brandName: '내가농협작목',
    features: '강화 순무, 잎 포함, 김장용',
    sizeInfo: '3kg, 뿌리 지름 8cm 전후',
    sensory: '뿌리는 아삭하고 잎은 향이 세요',
    origin: '인천 강화군 내가면',
    harvest: '11월 김장철',
    selection: '무른 뿌리 제외',
    producerStory: '갯벌 가까운 밭에서 키워요.',
    options: [{ name: '3kg', spec: '잎+뿌리' }],
    reviewsText: '순무김치 담그니 아삭하고 시원해요',
    salesRecord: '',
    shipping: '김장철 매일 출고',
    contact: '032-000-1616',
    certifications: [],
    gift: false,
  },
  {
    productName: '밀양 대추 500g',
    brandName: '얼음골대추',
    features: '밀양 건대추, 씨 있는 통대추, 당도 높음',
    sizeInfo: '500g, 특대 알',
    sensory: '달고 과육이 두꺼워요',
    origin: '경남 밀양시',
    harvest: '10월 수확 후 건조',
    selection: '벌레 구멍 제외',
    producerStory: '하우스에서 비를 막아 말려요.',
    options: [{ name: '500g', spec: '특대 건대추' }],
    reviewsText: '차로 끓이면 단맛이 진해요',
    salesRecord: '명절 시즌 1,500봉',
    shipping: '주문 다음날 출고',
    contact: '055-000-1717',
    certifications: [],
    gift: true,
  },
  {
    productName: '영광 굴비 20마리',
    brandName: '법성포굴비',
    features: '법성포 참조기 굴비, 천일염 간, 해풍 건조 2일',
    sizeInfo: '20마리, 한 마리 18cm 전후',
    sensory: '간이 세지 않고 구우면 고소해요',
    origin: '전남 영광 법성포',
    harvest: '가을 조기',
    selection: '배 터진 것 제외',
    producerStory: '법성포에서 부자가 덕장을 운영해요.',
    options: [{ name: '20마리', spec: '중굴비 선물세트' }],
    reviewsText: '기름기가 적당하고 짜지 않아요',
    salesRecord: '설 시즌 900세트',
    shipping: '냉동, 선물박스',
    contact: '061-000-1818',
    certifications: [],
    gift: true,
  },
  {
    productName: '남해 햇멸치 300g',
    brandName: '미조멸치',
    features: '남해 햇멸치, 조림용 중멸, 당일 삶아 건조',
    sizeInfo: '300g, 중멸 길이 4~5cm',
    sensory: '머리가 떨어지지 않고 고소해요',
    origin: '경남 남해군 미조',
    harvest: '3월~5월 햇멸치',
    selection: '가루·이물질 체질',
    producerStory: '새벽에 삶아 덕장에서 말려요.',
    options: [{ name: '300g', spec: '중멸' }],
    reviewsText: '국물 낼 때 잡내가 없어요',
    salesRecord: '',
    shipping: '주문 다음날 출고',
    contact: '055-000-1919',
    certifications: [],
    gift: false,
  },
  {
    productName: '철원 오대쌀 10kg',
    brandName: '동송RPC',
    features: '철원 오대쌀, 당일 도정, 햅쌀',
    sizeInfo: '10kg, 백미',
    sensory: '밥이 찰지고 밥맛이 고소해요',
    origin: '강원 철원군 동송',
    harvest: '10월 수확, 주문 후 도정',
    selection: '싸라기 비율 낮게 선별',
    producerStory: '철원평야 농가 벼를 RPC에서 도정해요.',
    options: [
      { name: '10kg', spec: '백미' },
      { name: '20kg', spec: '백미' },
    ],
    reviewsText: '밥맛이 차지고 다음날도 굳지 않아요',
    salesRecord: '이번 햅쌀 시즌 4,000포',
    shipping: '도정 다음날 출고',
    contact: '033-000-2020',
    certifications: [{ name: 'GAP', number: 'GAP-CW-88' }],
    gift: false,
  },
];

const BANNED = [
  '선사합니다',
  '경험해 보세요',
  '특별한 경험',
  '완벽한',
  '최고의',
  '놀라운',
  '혁신적인',
  '차원이 다른',
  '새로운 차원',
  '프리미엄 퀄리티',
  '고민 끝',
  '고민이신가요',
  '일상에 스며',
];
const MEDICAL = ['항암', '치료', '혈압을 낮', '당뇨에', '면역력을 높', '다이어트 효과', '효능이'];

const FUNNEL = [
  ['hero'],
  ['summary', 'concept'],
  ['review', 'certification', 'social_proof', 'facility'],
  ['quality', 'comparison', 'size_comparison', 'point_sum', 'detail', 'season', 'selection_process', 'taste'],
  ['point_origin', 'point_origin_reason', 'point_producer', 'point_producer_reason', 'point_direct'],
  ['recipe', 'storage_washing', 'usage', 'recommend'],
  ['spec', 'options', 'package', 'set_line_up'],
  ['conversion', 'promotion'],
  ['shipping_method', 'delivery', 'season_delivery_schedule', 'season_banner'],
  ['faq', 'contact', 'data_notice', 'notice_ai'],
];

function stageOf(id) {
  const i = FUNNEL.findIndex((s) => s.includes(id));
  return i === -1 ? 3 : i;
}

async function api(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path} ${res.status}: ${json.message || JSON.stringify(json)}`);
  return json.data ?? json;
}

function toInput(p) {
  return {
    startMode: 'new',
    productName: p.productName,
    productImagePaths: [],
    imageMode: 'blank',
    heroMotion: 'off',
    categoryId: 'agri',
    features: p.features,
    sizeInfo: p.sizeInfo,
    sensory: p.sensory,
    options: p.options,
    length: 'short',
    plan: p.gift ? '명절·선물로도 보냅니다. 산지 이야기로 신뢰를 주고 구매로 이끌어요.' : '제철 맛과 산지 선별로 설득하고 짧게 구매로 이끌어요.',
    reviewsText: p.reviewsText,
    brandName: p.brandName,
    agri: {
      origin: p.origin,
      harvest: p.harvest,
      selection: p.selection,
      producerStory: p.producerStory,
      directShipping: true,
    },
    certifications: p.certifications,
    salesRecord: p.salesRecord,
    promotion: p.promotion || (p.gift ? '선물 포장 요청 시 상자 동봉' : ''),
    shipping: p.shipping,
    contact: p.contact,
  };
}

function scoreComposition(c) {
  const ids = c.sectionTypeIds;
  const issues = [];
  if (ids[0] !== 'hero') issues.push('hero가 첫 섹션이 아님');
  const conv = ids.indexOf('conversion');
  if (conv < 0) issues.push('구매유도 없음');
  const hook = ['summary', 'concept'].map((id) => ids.indexOf(id)).filter((i) => i >= 0);
  if (!hook.length) issues.push('소개/컨셉 없음');
  if (conv >= 0 && hook.length && Math.min(...hook) > conv) issues.push('구매유도가 소개보다 앞');
  const proof = ['quality', 'point_sum', 'comparison', 'season'].map((id) => ids.indexOf(id)).filter((i) => i >= 0);
  if (conv >= 0 && proof.length && Math.min(...proof) > conv) issues.push('구매유도가 상품 근거보다 앞');
  const faq = ids.indexOf('faq');
  if (faq >= 0 && conv >= 0 && faq < conv) issues.push('FAQ가 구매유도보다 앞');
  const origin = ids.indexOf('point_origin');
  if (origin >= 0 && conv >= 0 && origin > conv) issues.push('산지가 구매유도 뒤');
  let inversions = 0;
  for (let i = 1; i < ids.length; i++) if (stageOf(ids[i]) < stageOf(ids[i - 1])) inversions += 1;
  if (inversions > 1) issues.push(`세일즈 순서 역전 ${inversions}회`);
  if (ids.length < 7) issues.push(`섹션 수 적음(${ids.length})`);
  return { issues, inversions, ids, names: c.sectionNames, title: c.title, strategy: c.strategy };
}

function collectText(section) {
  const parts = [section.title?.text, section.subtitle?.text, section.label?.text];
  for (const item of section.items ?? []) parts.push(item.title?.text, item.text?.text);
  return parts.filter(Boolean).join('\n');
}

function scoreCopy(plan, product) {
  const issues = [];
  const texts = [];
  for (const s of plan.sections ?? []) {
    const text = collectText(s);
    texts.push(text);
    if (!s.title?.text || s.title.text === s.typeId) issues.push(`${s.typeId}: 제목 부실`);
    if ((s.title?.text ?? '').includes('[입력 필요]') && product.features) issues.push(`${s.typeId}: 제목에 입력필요`);
    if ((s.items ?? []).some((it) => it.text?.text === '항목 1' || it.title?.text?.startsWith('항목 '))) {
      issues.push(`${s.typeId}: 플레이스홀더`);
    }
    for (const ban of BANNED) if (text.includes(ban)) issues.push(`${s.typeId}: 금지어 "${ban}"`);
    for (const med of MEDICAL) if (text.includes(med)) issues.push(`${s.typeId}: 효능 단정 "${med}"`);
    if (s.typeId === 'hero' && (s.title?.text ?? '').replace(/\s/g, '').length > 24) {
      issues.push(`hero: 메인 문구 김(${s.title.text})`);
    }
  }
  const blob = texts.join('\n');
  if ((blob.match(/해요/g) || []).length > 25) issues.push('해요 어미 과다');
  return { issues, titles: (plan.sections ?? []).map((s) => `${s.typeId}:${s.title?.text ?? ''}`), sectionCount: plan.sections?.length ?? 0 };
}

async function mapLimit(items, limit, fn) {
  const out = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx], idx);
      }
    }),
  );
  return out;
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitPlan(id, timeoutMs = 240_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const draft = await api('GET', `/drafts/${id}`);
    if (draft.status === 'ready' || draft.status === 'plan_failed') return draft;
    await sleep(2500);
  }
  throw new Error(`plan timeout ${id}`);
}

async function composeOne(product) {
  const created = await api('POST', '/drafts', { input: toInput(product) });
  const composed = await api('POST', `/drafts/${created.id}/compositions`);
  const candidates = (composed.candidates ?? []).map(scoreComposition);
  return { id: created.id, productName: product.productName, status: composed.status, candidates, product };
}

async function planOne(row) {
  const conversion = row.candidates.find((c) => c.strategy === 'conversion') ?? row.candidates[0];
  const raw = await api('GET', `/drafts/${row.id}`);
  const pick = raw.candidates?.find((c) => c.strategy === 'conversion') ?? raw.candidates?.[0];
  if (!pick) return { ...row, planIssues: ['후보 없음'], copy: null };
  const started = await api('POST', `/drafts/${row.id}/compositions/select`, { candidateId: pick.id });
  const done = started.status === 'ready' || started.status === 'plan_failed' ? started : await waitPlan(row.id);
  if (done.status === 'plan_failed') return { ...row, pick: conversion, planStatus: done.status, error: done.errorMessage, copy: null };
  return { ...row, pick: conversion, planStatus: done.status, copy: scoreCopy(done.plan, row.product), outline: (done.plan?.sections ?? []).map((s) => s.typeId) };
}

function summarize(rows) {
  const composeIssues = rows.flatMap((r) => r.candidates.flatMap((c) => c.issues.map((i) => `${r.productName}/${c.strategy}: ${i}`)));
  const planned = rows.filter((r) => r.copy);
  const copyIssues = planned.flatMap((r) => (r.copy?.issues ?? []).map((i) => `${r.productName}: ${i}`));
  const failed = rows.filter((r) => r.planStatus === 'plan_failed' || r.error);
  return {
    products: rows.length,
    planned: planned.length,
    failed: failed.map((r) => ({ name: r.productName, error: r.error })),
    composeIssueCount: composeIssues.length,
    copyIssueCount: copyIssues.length,
    composeIssues,
    copyIssues,
    samples: rows.map((r) => ({
      productName: r.productName,
      strategies: r.candidates.map((c) => `${c.strategy}:${c.names.join('→')}`),
      outline: r.outline,
      titles: r.copy?.titles,
      composeIssues: r.candidates.flatMap((c) => c.issues),
      copyIssues: r.copy?.issues ?? (r.error ? [r.error] : []),
    })),
  };
}

const main = async () => {
  const n = PRODUCTS.slice(0, Number(process.env.DRAFT_TEST_COUNT || 20));
  console.log(`compose ${n.length} agri drafts → ${BASE}`);
  const composed = await mapLimit(n, COMPOSE_CONCURRENCY, composeOne);
  for (const row of composed) {
    const bad = row.candidates.flatMap((c) => c.issues);
    console.log(`[compose] ${row.productName} ${row.candidates.length}안 ${bad.length ? `이슈 ${bad.join(', ')}` : 'OK'}`);
  }
  const toPlan = composed.slice(0, PLAN_LIMIT);
  console.log(`plan ${toPlan.length} drafts`);
  const planned = await mapLimit(toPlan, PLAN_CONCURRENCY, async (row) => {
    try {
      const result = await planOne(row);
      console.log(`[plan] ${row.productName} ${result.planStatus ?? 'skip'} ${(result.copy?.issues ?? []).join(' | ') || result.error || 'OK'}`);
      return result;
    } catch (err) {
      console.log(`[plan] ${row.productName} ERROR ${err.message}`);
      return { ...row, error: err.message, copy: null };
    }
  });
  const report = summarize(planned);
  const out = new URL('./agri-draft-test-report.json', import.meta.url);
  await import('node:fs/promises').then((fs) => fs.writeFile(out, JSON.stringify(report, null, 2)));
  console.log(JSON.stringify({ products: report.products, planned: report.planned, failed: report.failed, composeIssueCount: report.composeIssueCount, copyIssueCount: report.copyIssueCount, composeIssues: report.composeIssues, copyIssues: report.copyIssues }, null, 2));
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

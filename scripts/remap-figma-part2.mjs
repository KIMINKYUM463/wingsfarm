/**
 * 저장된 Figma 템플릿의 part2를 정식 구성명으로 재매핑한다.
 * (tsx 없이 Node에서 taxonomy 로직을 복제 — 실행: node scripts/remap-figma-part2.mjs)
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const INDEX = path.join(ROOT, '.data/detail-page/templates/index.json');

const PART2_ORDER = [
  '메인 비주얼',
  '문제 제기',
  '호기심 유발',
  '핵심 포인트',
  '상품 특징',
  '비교 분석',
  '인증·실적',
  '상세 정보',
  '사용 방법',
  '배송 안내',
  '고객 후기',
  'FAQ',
  '혜택·프로모션',
  '구매 안내',
  '전체 페이지',
  '모듈·기타',
];

const FULL_PAGE_MIN_HEIGHT = 5000;

const EXACT_PART2 = {
  '메인 비주얼': '메인 비주얼',
  '문제 제기': '문제 제기',
  문제제기: '문제 제기',
  '호기심 유발': '호기심 유발',
  '핵심 포인트': '핵심 포인트',
  '상품 특징': '상품 특징',
  '상세 정보': '상세 정보',
  '고객 후기': '고객 후기',
  고객후기: '고객 후기',
  '구매 안내': '구매 안내',
  '비교 분석': '비교 분석',
  '인증·실적': '인증·실적',
  '사용 방법': '사용 방법',
  사용방법: '사용 방법',
  '배송 안내': '배송 안내',
  FAQ: 'FAQ',
  '혜택·프로모션': '혜택·프로모션',
  '전체 페이지': '전체 페이지',
  '모듈·기타': '모듈·기타',
  '1-1 문제 제기': '문제 제기',
  '1-2 문제 해결': '문제 제기',
  '1-3 문제 해결 과정': '호기심 유발',
  '1-4 실적': '인증·실적',
  '1-5 추천 대상': '호기심 유발',
  '1-6 사용자 후기': '고객 후기',
  '1-7 전후 비교': '비교 분석',
  '2-1 대표 이미지': '메인 비주얼',
  '2-2 핵심 요약': '핵심 포인트',
  '2-3 핵심 포인트': '핵심 포인트',
  '2-4 특징 나열': '상품 특징',
  '2-5 제품 디테일': '상품 특징',
  '2-6 인증서': '인증·실적',
  '2-7 인증 마크': '인증·실적',
  '2-8 제작 과정': '사용 방법',
  '2-9 타사 제품 비교': '비교 분석',
  '3-1 사용 방법': '사용 방법',
  '3-2 자주 묻는 질문': 'FAQ',
  '3-3 상품 필수 정보': '상세 정보',
  '3-4 세탁·관리 방법': '사용 방법',
  '3-5 사이즈': '상세 정보',
  '3-5 배송 안내': '배송 안내',
  '3-6 프로모션': '혜택·프로모션',
  '3-7 배송 안내': '배송 안내',
  대표이미지: '메인 비주얼',
  인트로: '메인 비주얼',
  '시작 메시지': '메인 비주얼',
  포인트: '핵심 포인트',
  point: '핵심 포인트',
  차별포인트: '핵심 포인트',
  나열: '상품 특징',
  '특징 나열': '상품 특징',
  구체화: '상품 특징',
  요약: '핵심 포인트',
  '핵심 요약': '핵심 포인트',
  순서: '사용 방법',
  단계: '사용 방법',
  '과정/단계 모음': '사용 방법',
  디테일컷: '상품 특징',
  '제품 디테일': '상품 특징',
  비교: '비교 분석',
  경쟁제품비교: '비교 분석',
  '타사 제품 비교': '비교 분석',
  비포에프터: '비교 분석',
  후기: '고객 후기',
  '실제 사용 후기': '고객 후기',
  '리뷰 리스트 모음': '고객 후기',
  리뷰리스트모듈: '고객 후기',
  '사회적 증거': '고객 후기',
  SS: '고객 후기',
  실적: '인증·실적',
  누적판매량: '인증·실적',
  인증: '인증·실적',
  인증서: '인증·실적',
  '인증 관련 모음': '인증·실적',
  '사회적증거-인증': '인증·실적',
  '권위, 신뢰': '인증·실적',
  증거2: '인증·실적',
  '가치 입증': '인증·실적',
  '실험,표등': '인증·실적',
  'FAQ & 질문답변': 'FAQ',
  'FAQ/ 기타': 'FAQ',
  '질문 답변 모음': 'FAQ',
  'Q&A': 'FAQ',
  QNA모듈: 'FAQ',
  '혜택 & 프로모션': '혜택·프로모션',
  '제품정보 & 택배': '배송 안내',
  '세탁 및 관리방법': '사용 방법',
  '브랜드 스토리': '호기심 유발',
  페인포인트: '문제 제기',
  '문제 해결': '문제 제기',
  '추천 대상': '호기심 유발',
  '긍정 세트': '핵심 포인트',
  CA: '구매 안내',
  PS: '문제 제기',
  '소개형 (이미지 강조형)': '메인 비주얼',
  소개형: '메인 비주얼',
  다중정보: '상세 정보',
  다종정보: '상세 정보',
  '사진 박스 모음': '상품 특징',
  '텍스트 박스 모음': '모듈·기타',
  '텍스트 꾸밈 모음': '모듈·기타',
  텍스트꾸밈모듈: '모듈·기타',
  텍스트박스모듈: '모듈·기타',
  세부디자인박스모듈: '모듈·기타',
  스텝모듈: '사용 방법',
  차별화모듈: '핵심 포인트',
  Calendar_Notice_Detail: '배송 안내',
  백업: '모듈·기타',
  예시: '모듈·기타',
  'Section 1': '인증·실적',
  'Section 2': '모듈·기타',
  'Food 1_EX': '전체 페이지',
  'Food 2_EX': '전체 페이지',
  'Beauty 1_EX': '전체 페이지',
  'Beauty 2_EX': '전체 페이지',
  Travel_EX: '전체 페이지',
  Kids_EX: '전체 페이지',
  Fashion_EX: '전체 페이지',
  Stationery_EX: '전체 페이지',
  Concept1_EX: '전체 페이지',
  Concept2_EX: '전체 페이지',
  수산물: '전체 페이지',
  선물세트: '전체 페이지',
};

const PRODUCT_PAGE_PART2 = new Set([
  '참외', '사과', '애플망고', '무지개망고', '골드망고', '블루베리', '오렌지', '레드키위', '복숭아',
  '토마토', '수박', '레몬', '머스크메론', '대석자두', '살구', '매실', '세지멜론', '망고스틴',
  '가야백자멜론', '키위', '무화과', '양구멜론', '샤인머스캣', '체리', '피자두', '거봉', '청사과', '배',
  '전복', '김', '자반고등어', '가자미', '임연수', '참조기', '볼락필렛', '황태채', '반건조오징어',
  '반건조노가리', '마른오징어', '쫄쫄이오징어', '활암꽃게', '멍게', '새꼬막', '대게', '킹크랩',
  '명태포', '순살삼치', '반건조 박대', '왕우렁이', '흑골뱅이', '홍게', '바지락', '반건조우럭',
  '갑오징어', '새우', '보라성게알(우니)', '과메기', '밥새우', '건홍합', '새우장', '급냉낙지',
  '손질먹태', '건딱새우', '사각조각다시마', '고구마', '옥수수', '아보카도', '피망', '오이',
  '아스파라거스', '햇양파', '초당옥수수', '마늘쫑', '파프리카', '밤호박', '흙생강', '송화버섯',
  '햇감자', '두릅', '당근',
]);

const DETAIL_PREFIXES = new Set([
  '제품 상세정보 - 생활용품',
  '제품 상세정보 - 식품',
  '제품 상세정보 - 전자제품',
  '제품 상세정보 - 가구',
  '제품 상세정보 - 건강기능식품',
  '사이즈 - 생활용품',
  '사이즈 - 전자제품',
  '사이즈 - 가구',
]);

const CANONICAL = new Set(PART2_ORDER);

function classifyByKeywords(text) {
  const t = String(text || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  if (!t) return null;
  if (/배송|택배|delivery|출고|schedule/.test(t)) return '배송 안내';
  if (/\bfaq\b|q\s*&?\s*a|질문|ama|문의/.test(t)) return 'FAQ';
  if (/혜택|프로모션|promo|이벤트|쿠폰|option section/.test(t)) return '혜택·프로모션';
  if (/후기|review|testimonial|리뷰/.test(t)) return '고객 후기';
  if (/인증|실적|권위|trust|badge|performance|누적|판매량|cert/.test(t)) return '인증·실적';
  if (/비교|compare|전후|비포|vs\b|경쟁/.test(t)) return '비교 분석';
  if (/사용\s*방법|how\s*to|guide section|세탁|관리\s*방법|보관\s*방법|레시피|recipe|조리법|스텝모듈|제작 과정|사용 순서/.test(t))
    return '사용 방법';
  if (/문제|페인|pain|problem|불편/.test(t)) return '문제 제기';
  if (/추천|recommend|이런 분|대상/.test(t)) return '호기심 유발';
  if (/스토리|brand|브랜드|이야기|story/.test(t)) return '호기심 유발';
  if (/포인트|point|keypoint|key-?feature|핵심|차별|usp|featured|functional/.test(t)) return '핵심 포인트';
  if (/특징|나열|디테일|detail|feature|ingredient|원재료|패키지|package|체크리스트|checklist|데이터 섹션|data section/.test(t))
    return '상품 특징';
  if (/outro|구매|cta|conversion|문의처|고객센터|contact|가격정보|notice|주의할|주의점/.test(t))
    return '구매 안내';
  if (/intro|hero|main section|대표\s*이미지|소개형|커버|시작 메시지/.test(t)) return '메인 비주얼';
  if (/필수\s*정보|상품\s*정보|스펙|spec|사이즈|size|규격|다중정보|다종정보/.test(t)) return '상세 정보';
  if (/텍스트\s*꾸밈|텍스트꾸밈|텍스트박스|세부디자인|장식|ornament|편집하기|^편집$/.test(t)) return '모듈·기타';
  return null;
}

function normalizePart2({ part2, name, height }) {
  const raw = String(part2 || '').trim();
  const n = String(name || '').trim();
  const h = Number(height) || 0;
  if (h >= FULL_PAGE_MIN_HEIGHT) return '전체 페이지';
  if (PRODUCT_PAGE_PART2.has(raw)) return '전체 페이지';
  if (/_EX$/i.test(raw)) return '전체 페이지';
  if (DETAIL_PREFIXES.has(raw)) return '상세 정보';
  if (EXACT_PART2[raw]) return EXACT_PART2[raw];
  if (CANONICAL.has(raw) && raw !== '모듈·기타') return raw;
  return classifyByKeywords(n) || classifyByKeywords(raw) || '모듈·기타';
}

function sortKeyOf(part2) {
  const i = PART2_ORDER.indexOf(part2);
  return i >= 0 ? i + 1 : PART2_ORDER.length + 1;
}

const index = JSON.parse(fs.readFileSync(INDEX, 'utf8'));
const counts = {};
const transitions = {};
let changed = 0;

for (const t of index.templates) {
  if (t.source !== 'figma') continue;
  const next = normalizePart2({ part2: t.part2, name: t.name, height: t.height });
  const key = `${t.part2} → ${next}`;
  transitions[key] = (transitions[key] || 0) + 1;
  if (t.part2 !== next || t.part2SortKey !== sortKeyOf(next)) {
    t.part2 = next;
    t.part2SortKey = sortKeyOf(next);
    changed += 1;
  }
  counts[next] = (counts[next] || 0) + 1;
}

fs.writeFileSync(INDEX, JSON.stringify(index, null, 2) + '\n');

console.log('changed', changed);
console.log('\n=== 구성별 개수 ===');
for (const p of PART2_ORDER) console.log(`${String(counts[p] || 0).padStart(4)}  ${p}`);
console.log('\n=== 상위 전환 ===');
Object.entries(transitions)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 40)
  .forEach(([k, v]) => console.log(`${String(v).padStart(4)}  ${k}`));

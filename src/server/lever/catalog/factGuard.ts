/**
 * 사실 검사 — AI 문구에 "입력에 없는 주장"이 들어갔는지 찾는다.
 * 후커블 분석에서 가장 큰 위험(산지직송·인증·1위·후기·효능을 지어냄)을 막기 위한 장치.
 *
 * 규칙: 문구에서 주장 표현이 발견됐는데, 사용자가 입력한 자료 어디에도 같은 계열 단어가 없으면 경고.
 */
interface ClaimRule {
  label: string;
  pattern: RegExp;
  /** 입력 자료에 이 중 하나라도 있으면 근거가 있는 것으로 본다 */
  evidence: string[];
}

const RULES: ClaimRule[] = [
  { label: '산지직송', pattern: /산지\s*직송|직송/, evidence: ['직송', '직배송', '산지에서'] },
  { label: '친환경·유기농', pattern: /유기농|무농약|저농약|친환경|무항생제/, evidence: ['유기농', '무농약', '저농약', '친환경', '무항생제'] },
  { label: '인증', pattern: /GAP|HACCP|해썹|KC\s*인증|GMP|인증\s*(?:받|획득|완료)|식약처|기능성\s*인정/i, evidence: ['인증', 'gap', 'haccp', '해썹', 'kc', 'gmp', '식약처', '기능성'] },
  { label: '순위·판매 실적', pattern: /\d+\s*위|1등|베스트\s*셀러|누적\s*판매|판매량|\d[\d,.]*\s*만?\s*(?:개|병|박스|세트)\s*판매|재구매율|완판/, evidence: ['순위', '판매', '베스트', '재구매', '완판'] },
  { label: '후기·만족도', pattern: /만족도|\d+\s*%\s*(?:만족|재구매)|후기\s*\d|리뷰\s*\d|별점|평점/, evidence: ['후기', '리뷰', '만족', '별점', '평점'] },
  { label: '당도·수치', pattern: /\d+(?:\.\d+)?\s*(?:브릭스|brix|bx)|당도\s*\d/i, evidence: ['브릭스', 'brix', 'bx', '당도'] },
  { label: '수확·신선 표현', pattern: /당일\s*수확|수확\s*당일|갓\s*(?:딴|잡은|수확)|새벽\s*수확/, evidence: ['당일', '갓딴', '갓잡', '새벽'] },
  { label: '배송 약속', pattern: /오늘\s*(?:출발|발송|출고)|당일\s*(?:발송|출고|배송)|익일\s*(?:도착|배송)|내일\s*도착|무료\s*배송/, evidence: ['당일', '오늘출발', '오늘발송', '익일', '내일도착', '무료배송'] },
  { label: '연락처·운영 시간', pattern: /\d{2,4}-\d{3,4}-\d{4}|운영\s*시간|(?:평일|주말|토요일)\s*(?:오전|오후)?\s*\d{1,2}\s*(?:시|:)/, evidence: ['고객센터', '연락처', '전화', '운영시간'] },
  { label: '원산지', pattern: /국내산|국산|100\s*%\s*(?:국내|국산)/, evidence: ['국내산', '국산', '원산지', '산지'] },
  { label: '무첨가', pattern: /무첨가|무방부제|무색소|방부제\s*(?:없|0)|화학\s*첨가물\s*(?:없|0)/, evidence: ['무첨가', '방부제', '색소', '첨가물'] },
  { label: '최상급 표현', pattern: /최고급|최상급|최초|유일|국내\s*최대|업계\s*최고|100\s*%(?!\s*(?:국내|국산))|완벽/, evidence: ['최고', '최상', '최초', '유일', '최대', '100%', '완벽'] },
  { label: '효능·의학 표현', pattern: /면역|치료|예방|완치|항암|혈압|혈당|다이어트|살\s*빠|체지방|피부\s*재생|주름\s*개선|미백|탈모/, evidence: ['면역', '치료', '예방', '항암', '혈압', '혈당', '다이어트', '체지방', '재생', '주름', '미백', '탈모', '기능성'] },
];

const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, '');

export interface ClaimWarning {
  label: string;
  match: string;
}

/** 문구 하나를 검사해 근거 없는 주장 목록을 돌려준다 */
export function findUnsupportedClaims(text: string, evidenceText: string): ClaimWarning[] {
  if (!text) return [];
  const evidence = normalize(evidenceText);
  const warnings: ClaimWarning[] = [];
  for (const rule of RULES) {
    const m = text.match(rule.pattern);
    if (!m) continue;
    const supported = evidence.includes(normalize(m[0])) || rule.evidence.some((k) => evidence.includes(normalize(k)));
    if (!supported) warnings.push({ label: rule.label, match: m[0] });
  }
  return warnings;
}

/** 경고 목록을 사람이 읽을 문장으로 */
export const describeWarnings = (warnings: ClaimWarning[]) =>
  warnings.map((w) => `"${w.match}" — ${w.label} 근거가 입력 자료에 없어요`);

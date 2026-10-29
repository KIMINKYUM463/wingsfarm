import type { DraftLine } from '@/shared/types/draft';

/** 문장에 붙은 근거 id → 사람이 읽을 이름 */
const LABELS: Record<string, string> = {
  product: '상품명',
  brand: '브랜드',
  feature: '특징',
  option: '옵션',
  agri: '농수산물 정보',
  certification: '인증',
  sales: '판매 실적',
  promotion: '혜택',
  facility: '시설',
  shipping: '배송 정보',
  contact: '고객센터',
  plan: '기획안',
  review: '실제 후기',
  photo: '사진',
  general: '일반 표현',
  user: '직접 작성',
};

const AGRI: Record<string, string> = { origin: '산지', harvest: '제철', selection: '선별 기준', producer: '생산자', direct: '산지직송' };

export function evidenceLabel(ref: string) {
  const [kind, detail] = ref.split(':');
  if (kind === 'agri') return AGRI[detail] ?? LABELS.agri;
  if (kind === 'photo') return `사진 ${Number(detail) + 1}`;
  if (detail && /^\d+$/.test(detail) && kind !== 'review') return `${LABELS[kind] ?? kind} ${detail}`;
  return LABELS[kind] ?? ref;
}

/** 근거가 비어 있으면 "근거 없음" */
export const lineEvidence = (line: DraftLine | null) => (line ? (line.evidence.length ? line.evidence.map(evidenceLabel) : ['근거 없음']) : []);

/** 사용자가 고친 문장은 근거를 "직접 작성"으로 바꾼다 */
export const editedLine = (text: string): DraftLine => ({ text, evidence: ['user'] });

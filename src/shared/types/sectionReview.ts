/** AI 도우미 — 지금 보고 있는 섹션 평가 */
export interface SectionReviewRequest {
  name: string;
  /** 페이지 안 위치 (0부터) */
  index: number;
  total: number;
  texts: { text: string; fontSize: number }[];
  /** 섹션을 그린 JPG (data:image/jpeg;base64,…) — 디자인까지 보고 평가 */
  image?: string;
}

export interface SectionReviewTip {
  point: string;
  /** AI 편집 도우미(채팅)에 그대로 보낼 고치기 요청 — 문구로 고칠 수 있을 때만 */
  fixRequest?: string;
}

export interface SectionReviewResult {
  summary: string;
  good: string[];
  improve: SectionReviewTip[];
}

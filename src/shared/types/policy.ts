/**
 * 정책 문서 타입
 */
export type PolicyType = 'privacy' | 'refund' | 'terms';

/**
 * 정책 문서 데이터
 */
export interface PolicyData {
  policyType: PolicyType;
  version: string;
  title: string;
  content: string;
  contentFormat: 'markdown' | 'html';
  effectiveDate: string;
  updatedAt: string;
}

/**
 * 정책 조회 API 응답
 */
export interface PolicyResponse {
  isSuccess: boolean;
  code: string;
  message: string;
  data: PolicyData;
  errors: string | null;
  requestId: string;
}

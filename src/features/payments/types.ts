/**
 * Payments 관련 타입 정의
 */

/**
 * 크레딧 잔액 응답
 */
export interface CreditsResponse {
  balance: number;
  lastUpdated: string;
}

/**
 * 크레딧 API 응답
 */
export interface CreditsApiResponse {
  isSuccess: boolean;
  code: string;
  message: string;
  data: CreditsResponse;
}

/**
 * 트랜잭션 타입
 * - grant: 크레딧 지급 (구독, 구매, 프로모션 등)
 * - usage: 크레딧 사용 (이미지 생성 등)
 * - expire: 크레딧 만료
 * - refund: 크레딧 환불
 */
export type CreditTransactionType = 'grant' | 'usage' | 'expire' | 'refund';

/**
 * 크레딧 트랜잭션
 */
export interface CreditTransaction {
  id: string;
  type: CreditTransactionType;
  amount: number;
  description: string;
  referenceType: string;
  referenceId: string;
  createdAt: string;
}

/**
 * 크레딧 내역 응답
 */
export interface CreditsHistoryResponse {
  transactions: CreditTransaction[];
}

/**
 * 크레딧 내역 API 응답
 */
export interface CreditsHistoryApiResponse {
  isSuccess: boolean;
  code: string;
  message: string;
  data: CreditsHistoryResponse;
}

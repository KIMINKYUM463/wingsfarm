/**
 * 구독 및 결제수단 관련 타입 정의
 */

// ===== 결제수단 (빌링키) =====

/**
 * 등록된 결제수단 정보
 */
export interface BillingKey {
  id: string;
  cardName: string;
  cardNumberLast4: string;
  createdAt: string;
}

/**
 * 결제수단 목록 데이터
 */
export interface BillingKeysData {
  billingKeys: BillingKey[];
}

/**
 * 결제수단 목록 API 응답
 * GET /payments/billing-keys
 */
export interface BillingKeysApiResponse {
  isSuccess: boolean;
  code: string;
  message: string;
  data: BillingKeysData;
  errors: null;
  requestId: string;
}

/**
 * 결제수단 추가 요청
 * POST /payments/billing-keys
 */
export interface AddBillingKeyRequest {
  billingKey: string;
}

/**
 * 결제수단 추가 응답 데이터
 */
export interface AddBillingKeyData {
  billingKey: BillingKey;
}

/**
 * 결제수단 추가 API 응답
 * POST /payments/billing-keys
 */
export interface AddBillingKeyApiResponse {
  isSuccess: boolean;
  code: string;
  message: string;
  data: AddBillingKeyData;
  errors: null;
  requestId: string;
}

/**
 * 결제수단 삭제 응답 데이터
 */
export interface DeleteBillingKeyData {
  message: string;
}

/**
 * 결제수단 삭제 API 응답
 * DELETE /payments/billing-keys/{billingKeyId}
 */
export interface DeleteBillingKeyApiResponse {
  isSuccess: boolean;
  code: string;
  message: string;
  data: DeleteBillingKeyData;
  errors: null;
  requestId: string;
}

// ===== 구독 =====

/**
 * 구독 상태
 */
export type SubscriptionStatus = 'active' | 'canceled' | 'expired' | 'past_due';

/**
 * 결제 주기
 */
export type BillingCycle = 'monthly' | 'yearly';

/**
 * 구독 상세 정보
 */
export interface Subscription {
  id: string;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  autoRenewal: boolean;
  isTrial: boolean;
  trialEndsAt: string | null;
  createdAt: string;
}

/**
 * 구독 플랜 정보
 */
export interface SubscriptionPlan {
  id: string;
  name: string;
  displayName: string;
  creditsMonthly: number;
  priceMonthly: number;
  priceYearly: number;
}

/**
 * 내 구독 정보 데이터
 */
export interface MySubscriptionData {
  hasSubscription: boolean;
  /** 구독 이력 여부 (false면 무료 체험 가능) */
  hasSubscriptionHistory: boolean;
  subscription: Subscription | null;
  plan: SubscriptionPlan | null;
}

/**
 * 내 구독 정보 API 응답
 * GET /payments/subscriptions/me
 */
export interface MySubscriptionApiResponse {
  isSuccess: boolean;
  code: string;
  message: string;
  data: MySubscriptionData;
  errors: null;
  requestId: string;
}

/**
 * 플랜 목록 API 응답
 * GET /payments/subscriptions/plans
 */
export interface PlansApiResponse {
  isSuccess: boolean;
  code: string;
  message: string;
  data: { plans: SubscriptionPlan[] };
  errors: null;
  requestId: string;
}

/**
 * 구독 생성 요청
 * POST /payments/subscriptions
 *
 * billingKey는 서버에서 사용자의 등록된 결제수단에서 자동으로 가져옵니다.
 */
export interface CreateSubscriptionRequest {
  planId: string;
  billingCycle: BillingCycle;
}

/**
 * 결제 정보
 */
export interface PaymentInfo {
  id: string;
  paymentId: string;
  status: string;
  amount: number;
}

/**
 * 구독 생성 응답 데이터
 */
export interface CreateSubscriptionData {
  subscription: Subscription;
  payment: PaymentInfo;
  plan: SubscriptionPlan;
}

/**
 * 구독 생성 API 응답
 * POST /payments/subscriptions
 */
export interface CreateSubscriptionApiResponse {
  isSuccess: boolean;
  code: string;
  message: string;
  data: CreateSubscriptionData;
  errors: null;
  requestId: string;
}

/**
 * 구독 해지 응답 데이터
 */
export interface CancelSubscriptionData {
  subscriptionId: string;
  cancelledAt: string;
  effectiveEndDate: string;
  message: string;
}

/**
 * 구독 해지 API 응답
 * DELETE /payments/subscriptions/me
 */
export interface CancelSubscriptionApiResponse {
  isSuccess: boolean;
  code: string;
  message: string;
  data: CancelSubscriptionData;
  errors: null;
  requestId: string;
}

/**
 * 구독 재활성화 응답 데이터
 */
export interface ReactivateSubscriptionData {
  subscriptionId: string;
  autoRenewal: boolean;
  message: string;
}

/**
 * 구독 재활성화 API 응답
 * POST /payments/subscriptions/me/reactivate
 */
export interface ReactivateSubscriptionApiResponse {
  isSuccess: boolean;
  code: string;
  message: string;
  data: ReactivateSubscriptionData;
  errors: null;
  requestId: string;
}

// ===== 크레딧 상품 =====

/**
 * 크레딧 상품 정보
 */
export interface CreditProduct {
  id: string;
  name: string;
  displayName: string;
  credits: number;
  bonusCredits: number;
  totalCredits: number;
  price: number;
  discountRate: number;
  description: string;
}

/**
 * 크레딧 상품 목록 API 응답
 * GET /payments/credits/products
 */
export interface CreditProductsApiResponse {
  isSuccess: boolean;
  code: string;
  message: string;
  data: { products: CreditProduct[] };
  errors: null;
  requestId: string;
}

/**
 * 크레딧 구매 준비 응답 데이터
 */
export interface CreditPurchasePrepareData {
  paymentId: string;
  orderName: string;
  amount: number;
  totalCredits: number;
  /** 포트원 웹훅 수신 URL (SDK에 그대로 전달) */
  noticeUrls: string[];
}

/**
 * 크레딧 구매 준비 API 응답
 * POST /payments/credits/purchase/prepare
 */
export interface CreditPurchasePrepareApiResponse {
  isSuccess: boolean;
  code: string;
  message: string;
  data: CreditPurchasePrepareData;
  errors: null;
  requestId: string;
}

/**
 * 크레딧 구매 완료 응답 데이터
 */
export interface CreditPurchaseCompleteData {
  /** 크레딧 지급 완료 여부 */
  credited: boolean;
}

/**
 * 크레딧 구매 완료 API 응답
 * POST /payments/credits/purchase/complete
 */
export interface CreditPurchaseCompleteApiResponse {
  isSuccess: boolean;
  code: string;
  message: string;
  data: CreditPurchaseCompleteData;
  errors: null;
  requestId: string;
}

// ===== 결제 내역 =====

/**
 * 결제 상태
 */
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'cancelled';

/**
 * 결제 내역 항목
 */
export interface PaymentHistoryItem {
  id: string;
  paymentId: string;
  type: string;
  orderName: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  paidAt: string;
  createdAt: string;
  paymentMethod: string;
  customerName: string;
  customerEmail: string;
  receiptUrl: string;
  approvalNumber: string;
  installmentMonth: number | null;
}

/**
 * 페이지네이션 정보
 */
export interface Pagination {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

/**
 * 결제 내역 데이터
 */
export interface PaymentHistoryData {
  payments: PaymentHistoryItem[];
  pagination: Pagination;
}

/**
 * 결제 내역 API 응답
 * GET /payments/history
 */
export interface PaymentHistoryApiResponse {
  isSuccess: boolean;
  code: string;
  message: string;
  data: PaymentHistoryData;
  errors: null;
  requestId: string;
}

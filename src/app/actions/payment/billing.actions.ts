/**
 * 결제 관련 서버 액션
 *
 * 윙스팜AI 로컬 버전은 결제·구독이 없다 (본인 Gemini API 키로 무제한 사용).
 * 레버페이지 화면 코드가 그대로 동작하도록 같은 함수 이름을 유지하고,
 * 조회는 빈 결과를, 결제 동작은 안내 메시지를 돌려준다.
 */

'use server';

import { withServerAction } from '../shared/utils/middleware';
import { CustomError } from '@/shared/lib/CustomError';
import type {
  BillingKey,
  AddBillingKeyData,
  DeleteBillingKeyData,
  CreateSubscriptionRequest,
  CreateSubscriptionData,
  CancelSubscriptionData,
  ReactivateSubscriptionData,
  PaymentHistoryData,
  CreditPurchasePrepareData,
  CreditPurchaseCompleteData,
} from '@/shared/types/subscription.types';

const notSupported = async (): Promise<never> => {
  throw new CustomError(400, '윙스팜AI에서는 결제 없이 본인 Gemini API 키로 사용합니다.');
};

/** 빌링키(결제수단) 목록 조회 — 항상 비어 있음 */
export const getBillingKeys = withServerAction(async (): Promise<BillingKey[]> => []);

export const addBillingKey = withServerAction(
  async (_billingKey: string): Promise<AddBillingKeyData> => notSupported(),
);

export const deleteBillingKey = withServerAction(
  async (_billingKeyId: string): Promise<DeleteBillingKeyData> => notSupported(),
);

export const createSubscription = withServerAction(
  async (_request: CreateSubscriptionRequest): Promise<CreateSubscriptionData> => notSupported(),
);

export const cancelSubscription = withServerAction(
  async (): Promise<CancelSubscriptionData> => notSupported(),
);

export const reactivateSubscription = withServerAction(
  async (): Promise<ReactivateSubscriptionData> => notSupported(),
);

/** 결제 내역 조회 — 항상 비어 있음 */
export const getPaymentHistory = withServerAction(
  async (params?: { limit?: number; offset?: number }): Promise<PaymentHistoryData> => ({
    payments: [],
    pagination: { total: 0, limit: params?.limit ?? 20, offset: params?.offset ?? 0, hasMore: false },
  }),
);

export const prepareCreditPurchase = withServerAction(
  async (_productId: string): Promise<CreditPurchasePrepareData> => notSupported(),
);

export const completeCreditPurchase = withServerAction(
  async (_paymentId: string): Promise<CreditPurchaseCompleteData> => notSupported(),
);

import 'server-only';
import type { MySubscriptionData } from '@/shared/types/subscription.types';
import { badRequest } from './http';
import { nowIso } from './store';

/**
 * 결제 API 대체 — 윙스팜AI는 본인 Gemini 키로 쓰므로 크레딧·구독 제한이 없다.
 * 화면이 "크레딧 부족" 등으로 막히지 않도록 넉넉한 값을 돌려준다.
 */
const UNLIMITED_CREDITS = 999_999;

export const MY_SUBSCRIPTION: MySubscriptionData = {
  hasSubscription: true,
  hasSubscriptionHistory: true,
  subscription: null,
  plan: null,
};

export const creditBalance = () => ({ balance: UNLIMITED_CREDITS, lastUpdated: nowIso() });

export const PAYMENT_LISTS = {
  'credits/me/history': { transactions: [] },
  'subscriptions/plans': { plans: [] },
  'credits/products': { products: [] },
  'billing-keys': { billingKeys: [] },
  history: { payments: [], pagination: { total: 0, limit: 20, offset: 0, hasMore: false } },
} as const;

export const paymentNotSupported = () => {
  throw badRequest('윙스팜AI에서는 결제 없이 본인 Gemini API 키로 사용합니다.');
};

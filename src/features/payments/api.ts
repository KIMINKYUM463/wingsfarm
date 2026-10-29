/**
 * Payments 관련 클라이언트 API 요청 함수
 */

import httpClient from '@/shared/lib/httpClient';
import { ENDPOINTS } from '@/shared/constants/endpoints';
import type { CreditsApiResponse, CreditsResponse } from './types';
import type { MySubscriptionData, MySubscriptionApiResponse } from '@/shared/types/subscription.types';

/**
 * 내 크레딧 잔액 조회
 *
 * @returns 크레딧 잔액 정보
 */
export const getMyCredits = async (): Promise<CreditsResponse> => {
  const response = await httpClient.get<CreditsApiResponse>(ENDPOINTS.PAYMENTS.CREDITS_ME, {
    withAuth: true,
  });

  return response.data;
};

/**
 * 내 구독 정보 조회 (클라이언트용)
 *
 * @returns 구독 정보
 */
export const getMySubscription = async (): Promise<MySubscriptionData> => {
  const response = await httpClient.get<MySubscriptionApiResponse>(
    ENDPOINTS.PAYMENTS.SUBSCRIPTIONS_ME,
    { withAuth: true },
  );

  return response.data;
};

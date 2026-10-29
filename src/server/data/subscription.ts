/**
 * 구독 데이터 (서버 전용)
 *
 * 윙스팜AI 로컬 버전은 결제가 없으므로 항상 "이용 가능" 상태를 돌려준다.
 */

import 'server-only';
import { cache } from 'react';
import { MY_SUBSCRIPTION } from '@/server/lever/payments';
import type { MySubscriptionData } from '@/shared/types/subscription.types';

/** 내 구독 정보 조회 */
export const getMySubscription = cache(async (): Promise<MySubscriptionData> => MY_SUBSCRIPTION);

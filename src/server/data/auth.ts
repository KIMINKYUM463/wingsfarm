/**
 * 서버 전용 인증 유틸리티
 * 서버 컴포넌트에서만 사용 가능
 *
 * [LCP 최적화] React cache()를 사용한 요청 단위 메모이제이션
 * - 같은 요청 내에서 여러 번 호출해도 Supabase API는 한 번만 호출
 * - 각 새 요청마다 fresh 데이터 조회 (영구 캐싱 아님)
 * - Next.js 공식 Data Access Layer(DAL) 패턴 적용
 */

import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { createServerSupabaseClient } from '@/shared/lib/supabase/server';
import { ROUTES } from '@/shared/constants/routes';
import { getMySubscription } from './subscription';
import type { User } from '@supabase/supabase-js';

/**
 * 내부 유저 조회 함수 (cache로 메모이제이션)
 * 같은 요청 내에서 중복 호출 시 캐시된 결과 반환
 */
const fetchUser = cache(async (): Promise<User | null> => {
  // 로그인 정보는 요청마다 확인 (빌드 때 미리 렌더링하지 않음)
  await connection();
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
});

/**
 * 서버 컴포넌트에서 현재 유저 조회 (리다이렉트 없음)
 *
 * [메모이제이션] 같은 요청 내에서 여러 번 호출해도 1회만 API 호출
 *
 * @returns 인증된 사용자 정보 또는 null
 */
export async function getUser(): Promise<User | null> {
  return fetchUser();
}

/**
 * 서버 컴포넌트에서 인증 필요한 페이지 보호
 * - 인증되지 않은 경우: /login으로 리다이렉트
 *
 * [메모이제이션] getUser()와 동일한 캐시 공유
 * - Layout에서 requireAuth() 호출 후 Page에서 getUser() 호출 시 추가 API 호출 없음
 *
 * @returns 인증된 사용자 정보
 *
 * @example
 * ```typescript
 * // 인증된 유저만 접근 가능한 페이지
 * export default async function Page() {
 *   const user = await requireAuth();
 *   // user를 사용한 로직...
 * }
 * ```
 */
export async function requireAuth(): Promise<User> {
  const user = await fetchUser();

  if (!user) {
    redirect(ROUTES.LOGIN);
  }

  return user;
}

/**
 * 서버 컴포넌트에서 구독 필요한 페이지 보호
 * - 인증 체크 (requireAuth 포함)
 * - 구독이 없는 경우: /pricing으로 리다이렉트
 *
 * @returns 인증된 사용자 정보
 *
 * @example
 * ```typescript
 * // 인증 + 구독 필요한 페이지
 * export default async function Page() {
 *   const user = await requireSubscription();
 *   // user를 사용한 로직...
 * }
 * ```
 */
export async function requireSubscription(): Promise<User> {
  const user = await requireAuth();

  // 구독 상태 조회 (try-catch 밖에서 redirect 호출하여 에러 혼동 방지)
  let hasSubscription = false;

  try {
    const subscriptionData = await getMySubscription();
    hasSubscription = subscriptionData.hasSubscription;
  } catch (error) {
    // API 에러 시 로깅 후 구독 없음으로 처리
    console.error('[requireSubscription] 구독 조회 실패:', error);
    hasSubscription = false;
  }

  // 구독 없으면 pricing 페이지로 리다이렉트
  if (!hasSubscription) {
    redirect(ROUTES.PRICING);
  }

  return user;
}

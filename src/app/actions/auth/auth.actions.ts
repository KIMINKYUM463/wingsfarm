/**
 * Auth 관련 서버 액션
 *
 * 인증 관련 서버 액션들을 정의합니다.
 * logout/signIn은 redirect, revalidatePath 등 특수 처리가 필요하므로
 * withServerAction을 사용하지 않고 직접 처리합니다.
 */

'use server';

import { createServerSupabaseClient } from '@/shared/lib/supabase/server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { CustomError } from '@/shared/lib/CustomError';
import { ROUTES } from '@/shared/constants/routes';

/**
 * 서버에서 로그아웃 처리
 *
 * ## 동작 방식 (쿠키 기반 SSR 환경)
 * 1. Server Action에서 Supabase 클라이언트 생성
 * 2. `signOut()` 호출하여 Supabase 세션 종료
 * 3. 쿠키에 저장된 세션 토큰 자동 제거
 * 4. 레이아웃 재검증으로 인증 상태 갱신
 * 5. 로그인 페이지로 자동 리다이렉트
 *
 * @throws {CustomError} 로그아웃 중 오류 발생 시
 */
export async function logoutAction() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
    error: getUserError,
  } = await supabase.auth.getUser();

  if (getUserError) {
    throw new CustomError(500, '사용자 정보를 가져오는 중 오류가 발생했습니다');
  }

  if (user) {
    const { error: signOutError } = await supabase.auth.signOut();

    if (signOutError) {
      throw new CustomError(500, '로그아웃 중 오류가 발생했습니다');
    }
  }

  revalidatePath('/', 'layout');
  redirect(ROUTES.LOGIN);
}


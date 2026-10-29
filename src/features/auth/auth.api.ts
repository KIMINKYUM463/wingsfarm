/**
 * Auth 관련 클라이언트 API 요청 함수
 */
import { getBrowserSupabaseClient } from '@/shared/lib/supabase/client';
import type { Provider, OAuthResponse, User, UserResponse } from '@supabase/supabase-js';
import { handleApiResponse } from '@/shared/lib/apiHandler';
/**
 * OAuth Provider 타입
 * 지원하는 소셜 로그인 제공자 목록입니다.
 */
export type OAuthProvider = 'kakao' | 'google' | 'github' | 'facebook';

/**
 * OAuth 로그인 시 전달할 옵션 객체의 타입입니다.
 */
export interface OAuthSignInOptions {
  /** OAuth 제공자 (예: 'kakao', 'google') */
  provider: OAuthProvider;
  /** 로그인 성공 후 돌아올 URL (선택 사항) */
  redirectTo?: string;
  /** 추가적인 OAuth 옵션 (스코프 등) */
  options?: {
    scopes?: string;
    queryParams?: Record<string, string>;
  };
}

/**
 * 범용 OAuth 로그인 함수
 * 여러 OAuth 제공자를 지원하며, API 호출과 에러 처리를 추상화합니다.
 *
 * ## OAuth 리다이렉트 흐름
 * 1. 사용자가 OAuth 제공자(카카오/구글)에서 로그인
 * 2. OAuth 제공자가 /auth/callback?code=xxx 로 리다이렉트
 * 3. 서버 라우트 핸들러가 code를 세션으로 교환
 * 4. 최종적으로 redirectTo URL로 이동
 *
 * @param provider - OAuth 제공자 (kakao, google 등)
 * @param redirectTo - 로그인 완료 후 이동할 최종 경로 (기본값: /auth/callback)
 * @param options - 추가 OAuth 옵션 (스코프 등)
 */
export const signInWithOAuth = ({
  provider,
  redirectTo,
  options,
}: OAuthSignInOptions): Promise<OAuthResponse['data']> => {
  const supabase = getBrowserSupabaseClient();

  // 현재 페이지 경로를 저장 (로그인 후 돌아올 위치)
  const currentPath = redirectTo ?? window.location.pathname;

  // OAuth 콜백 URL에 next 파라미터 추가
  const callbackUrl = `${window.location.origin}/auth/callback?next=${encodeURIComponent(currentPath)}`;

  const promise = supabase.auth.signInWithOAuth({
    provider: provider as Provider,
    options: {
      redirectTo: callbackUrl,
      ...options,
    },
  });

  // handleApiResponse 헬퍼를 사용하여 API 호출을 감싸고,
  // Supabase가 반환하는 공식 타입을 제네릭으로 전달합니다.
  return handleApiResponse<OAuthResponse['data']>(promise);
};

export const getUser = async (): Promise<User | null> => {
  const supabase = getBrowserSupabaseClient(); // 싱글톤 클라이언트 사용
  const promise = supabase.auth.getUser();

  // handleApiResponse를 사용하여 API 호출을 감싸고, data 타입 ({ user: User | null })을 명시합니다.
  const { user } = await handleApiResponse<UserResponse['data']>(promise);

  // user 속성을 추출하여 반환합니다.
  return user;
};

/**
 * Kakao 로그인을 위한 편의 함수
 */
export const signInWithKakao = () => signInWithOAuth({ provider: 'kakao' });

/**
 * Google 로그인을 위한 편의 함수
 */
export const signInWithGoogle = () => signInWithOAuth({ provider: 'google' });

/**
 * 로그아웃 함수
 *
 * ⚠️ 주의: 이 함수는 더 이상 사용하지 않습니다.
 * 대신 Server Action을 사용하세요: `import { logoutAction } from '@/app/actions/auth'`
 *
 * @deprecated Server Action `logoutAction`을 사용하세요
 * @see /src/app/actions/auth/auth.actions.ts
 */

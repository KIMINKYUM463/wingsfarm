/**
 * 서버 전용 인증 헬퍼
 *
 * ⚠️ 주의: 이 파일은 서버 환경에서만 import되어야 합니다.
 * 클라이언트 번들에 포함되면 안 됩니다.
 *
 * 이 파일은 `server-only` 패키지를 사용하지 않고,
 * 동적 import만으로 클라이언트 번들에서 제외합니다.
 */

/**
 * 서버 환경에서 Supabase 세션의 액세스 토큰으로 Authorization 헤더를 생성합니다.
 *
 * ## ⚠️ 중요: 서버 전용 함수
 * - **서버 환경에서만 사용**됩니다 (서버 액션, 라우트 핸들러 등)
 * - Next.js `cookies()`를 사용하여 세션 가져오기
 * - 에러는 상위(request, withServerAction)에서 처리
 *
 * ## 동작 원리
 * 1. createServerSupabaseClient()를 동적으로 import (클라이언트 번들 제외)
 * 2. getSession()으로 쿠키에서 세션 가져오기
 * 3. 세션에서 액세스 토큰 추출
 * 4. Bearer 토큰 형식으로 Authorization 헤더 반환
 *
 * @returns Authorization 헤더 객체 또는 빈 객체 (인증되지 않은 경우)
 * @throws 세션 가져오기 실패 시 에러 전파
 */
export const getServerAuthHeaders = async (): Promise<Record<string, string>> => {
  // 동적 import로 서버 전용 모듈 로드 (클라이언트 번들에서 제외)
  const { createServerSupabaseClient } = await import('@/shared/lib/supabase/server');
  const supabase = await createServerSupabaseClient();

  // getSession()으로 쿠키에서 세션 가져오기
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // 세션 토큰이 없으면 빈 객체 반환 (조기 반환)
  if (!session?.access_token) {
    return {};
  }

  // Bearer 토큰 형식으로 반환
  return {
    Authorization: `Bearer ${session.access_token}`,
  };
};

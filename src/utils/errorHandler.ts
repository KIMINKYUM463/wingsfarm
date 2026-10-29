import { showToast } from '@/utils/toast';
import { CustomError } from '@/shared/lib/CustomError';
import { ERROR_MESSAGES, DEFAULT_ERROR_MESSAGE } from '@/shared/constants/messages';
import { ROUTES } from '@/shared/constants/routes';
import type { MiddlewareResponse, SerializableError } from '@/app/actions/shared/types/common';

/**
 * Next.js 전역 에러 핸들러
 *
 * ## 지원하는 에러 타입
 * 1. SerializableError (서버 액션에서 throw, 직렬화 후에도 status 보존)
 * 2. MiddlewareResponse (서버 액션에서 반환 - 레거시)
 * 3. CustomError (클라이언트에서 throw)
 * 4. 일반 Error
 *
 * ## 에러 메시지 우선순위
 * 1. 서버에서 보낸 구체적인 메시지 (rawMessage)
 * 2. ERROR_MESSAGES 상수의 일반 메시지 (statusCode 기반)
 * 3. 기본 메시지 (DEFAULT_ERROR_MESSAGE)
 *
 * ## 401 에러 처리
 * - /login 페이지로 리다이렉트
 * - 인증 상태 초기화
 */

/**
 * SerializableError 타입 가드
 */
const isSerializableError = (error: unknown): error is SerializableError => {
  return (
    typeof error === 'object' &&
    error !== null &&
    '__isSerializableError' in error &&
    (error as SerializableError).__isSerializableError === true
  );
};

/**
 * 에러 객체에서 상태 코드와 메시지 추출
 */
const parseError = (error: unknown): { statusCode: number; errorMessage: string } => {
  // 1. SerializableError (서버 액션에서 throw, 직렬화 후에도 status 보존)
  if (isSerializableError(error)) {
    const statusCode = error.status;
    // rawMessage가 있으면 우선 사용, 없으면 message, 없으면 ERROR_MESSAGES
    const errorMessage =
      error.rawMessage || error.message || ERROR_MESSAGES[statusCode] || DEFAULT_ERROR_MESSAGE;

    return { statusCode, errorMessage };
  }

  // 2. MiddlewareResponse (서버 액션에서 { success: false, error, statusCode } 반환 - 레거시)
  if (typeof error === 'object' && error !== null && 'success' in error) {
    const response = error as MiddlewareResponse;
    const statusCode = response.statusCode ?? 500;

    // 서버에서 보낸 메시지가 있으면 우선 사용, 없으면 ERROR_MESSAGES 사용
    const errorMessage = response.error || ERROR_MESSAGES[statusCode] || DEFAULT_ERROR_MESSAGE;

    return { statusCode, errorMessage };
  }

  // 3. CustomError (클라이언트에서 throw) - rawMessage 우선 사용
  if (error instanceof CustomError) {
    return {
      statusCode: error.status,
      // rawMessage가 있으면 우선 사용, 없으면 ERROR_MESSAGES로 생성된 message 사용
      errorMessage: error.rawMessage || error.message,
    };
  }

  // 4. 일반 Error - 예외적인 경우로 그대로 메시지 전달
  if (error instanceof Error) {
    return {
      statusCode: 500,
      errorMessage: error.message,
    };
  }

  // 5. 기타 (예상치 못한 에러)
  console.error('Unexpected error:', error);
  return {
    statusCode: 500,
    errorMessage: DEFAULT_ERROR_MESSAGE,
  };
};

/**
 * 401 에러 처리: /login 페이지로 리다이렉트 + 인증 상태 초기화
 */
const handle401Error = async () => {
  const { useAuthStore } = await import('@/features/auth/store/useAuthStore');

  // 인증 상태 초기화
  useAuthStore.getState().clearUser();

  // /login 페이지로 리다이렉트
  window.location.href = ROUTES.LOGIN;
};

export const handleAppError = async (error: unknown) => {
  const { statusCode, errorMessage } = parseError(error);
  // 401: 인증 에러 - /login 페이지로 리다이렉트 (조기 반환)
  if (statusCode === 401) {
    await handle401Error();
    return;
  }
  if (statusCode === 429) {
    window.alert(
      '오늘 사용 가능한 5회 횟수를 모두 사용하셨습니다.\n이용 횟수는 매일 자정에 초기화됩니다.',
    );
    return;
  }

  // 400대/500대 에러: 토스트로 표시
  showToast.error(errorMessage);
};

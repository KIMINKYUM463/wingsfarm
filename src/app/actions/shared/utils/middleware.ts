import { CustomError } from '@/shared/lib/CustomError';
import type { MiddlewareResponse, SerializableError } from '../types/common';

/**
 * Next.js 내부 에러인지 확인 (redirect, notFound 등)
 *
 * Next.js의 redirect()와 notFound()는 특수한 에러를 throw합니다.
 * 이 에러들은 프레임워크가 처리해야 하므로 catch하지 않고 rethrow해야 합니다.
 *
 * @see https://nextjs.org/docs/app/api-reference/functions/redirect
 */
const isNextjsInternalError = (error: unknown): boolean => {
  if (error instanceof Error && 'digest' in error) {
    const digest = (error as Error & { digest?: string }).digest;
    // Next.js 내부 에러는 NEXT_REDIRECT, NEXT_NOT_FOUND 등의 digest를 가짐
    return typeof digest === 'string' && digest.startsWith('NEXT_');
  }
  return false;
};

/**
 * CustomError를 직렬화 가능한 객체로 변환
 *
 * Server Action에서 throw된 에러는 클라이언트로 전송 시 직렬화되어
 * CustomError의 status, rawMessage가 손실됩니다.
 * 이 함수로 변환하면 에러 정보가 plain object로 보존됩니다.
 */
const toSerializableError = (error: unknown): SerializableError => {
  if (error instanceof CustomError) {
    return {
      __isSerializableError: true,
      status: error.status,
      message: error.message,
      rawMessage: error.rawMessage,
    };
  }

  if (error instanceof Error) {
    return {
      __isSerializableError: true,
      status: 500,
      message: error.message,
    };
  }

  return {
    __isSerializableError: true,
    status: 500,
    message: 'Unknown error',
  };
};

/**
 * 공통 미들웨어 함수 (인증 불필요한 액션용, 레거시 - return 패턴)
 *
 * @deprecated 새 코드에서는 withServerAction 사용 권장
 */
export const withMiddleware = <TInput extends readonly unknown[], TOutput>(
  action: (...args: TInput) => Promise<TOutput>,
) => {
  return async (...args: TInput): Promise<MiddlewareResponse<TOutput>> => {
    try {
      const result = await action(...args);
      return { success: true, data: result };
    } catch (error) {
      // CustomError이면 status 코드 사용, 일반 Error이면 500
      const statusCode = error instanceof CustomError ? error.status : 500;

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        statusCode,
      };
    }
  };
};

// ===== 통합 미들웨어 =====

interface ServerActionOptions {
  /** true면 인증 체크 수행 (기본값: false) */
  requireAuth?: boolean;
}

/**
 * 서버 액션 래퍼 (통합 미들웨어)
 *
 * ## 특징
 * - 에러 시 SerializableError로 변환하여 throw → 직렬화 후에도 status 보존
 * - 성공 시 데이터 직접 반환 (MiddlewareResponse 래핑 없음)
 * - useMutation과 함께 사용 권장
 *
 * ## 에러 직렬화 문제 해결
 * Server Action에서 CustomError를 throw하면 클라이언트로 전송 시 직렬화되어
 * instanceof 체크 실패 및 커스텀 프로퍼티(status, rawMessage) 손실이 발생합니다.
 * 이 미들웨어는 에러를 SerializableError(plain object)로 변환하여 정보를 보존합니다.
 *
 * ## 사용법
 * ```typescript
 * // 인증 필요한 액션
 * export const protectedAction = withServerAction(
 *   async (data) => await httpClient.post(...),
 *   { requireAuth: true }
 * );
 *
 * // 인증 불필요한 액션
 * export const publicAction = withServerAction(
 *   async (data) => await httpClient.post(...)
 * );
 *
 * // 클라이언트 (useMutation)
 * mutationFn: protectedAction,  // 그대로 전달, 추가 체크 불필요
 * ```
 */
export const withServerAction = <TInput extends readonly unknown[], TOutput>(
  action: (...args: TInput) => Promise<TOutput>,
  options?: ServerActionOptions,
) => {
  return async (...args: TInput): Promise<TOutput> => {
    try {
      // 인증 필요 시 체크
      if (options?.requireAuth) {
        const { createServerSupabaseClient } = await import('@/shared/lib/supabase/server');
        const supabase = await createServerSupabaseClient();

        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          throw new CustomError(401, '인증이 필요합니다. 로그인 후 다시 시도해주세요.');
        }
      }

      return await action(...args);
    } catch (error) {
      // Next.js 내부 에러(redirect, notFound)는 그대로 rethrow
      if (isNextjsInternalError(error)) {
        throw error;
      }

      // 에러를 직렬화 가능한 plain object로 변환하여 throw
      throw toSerializableError(error);
    }
  };
};


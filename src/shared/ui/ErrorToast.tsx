'use client';

import type { Route } from 'next';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { showToast } from '@/utils/toast';

interface ErrorToastProps {
  errorCode: string | null;
  errorMessage?: string | null;
  errorMap: Record<string, string>;
  cleanUrl?: Route;
}

/**
 * 제네릭 에러 토스트 컴포넌트
 *
 * @description
 * - 쿼리 파라미터로 전달된 에러를 토스트로 표시
 * - errorMap으로 에러 코드별 메시지 매핑
 * - cleanUrl 지정 시 토스트 표시 후 URL 정리 (쿼리 파라미터 제거)
 *
 * @example
 * ```tsx
 * <ErrorToast
 *   errorCode={searchParams.error}
 *   errorMessage={searchParams.message}
 *   cleanUrl="/login"
 *   errorMap={{
 *     missing_code: '로그인 인증 코드를 받지 못했습니다.',
 *     auth_failed: '로그인 중 문제가 발생했습니다.',
 *   }}
 * />
 * ```
 */
export default function ErrorToast({
  errorCode,
  errorMessage,
  errorMap,
  cleanUrl,
}: ErrorToastProps) {
  const router = useRouter();

  useEffect(() => {
    if (!errorCode) return;

    // 에러 메시지 결정 (우선순위: errorMessage > errorMap > 기본 메시지)
    const message = errorMessage || errorMap[errorCode] || '오류가 발생했습니다.';
    showToast.error(message);

    // URL에서 쿼리 파라미터 제거 (깔끔한 URL 유지)
    if (cleanUrl) {
      router.replace(cleanUrl, { scroll: false });
    }
  }, [errorCode, errorMessage, errorMap, cleanUrl, router]);

  return null;
}

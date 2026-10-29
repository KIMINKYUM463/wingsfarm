'use client';

import React from 'react';
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { handleAppError } from '@/utils/errorHandler';
import { AuthProvider } from '@/features/auth/components/AuthProvider';

// 1. QueryClient 생성 함수 정의
function makeQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      // 모든 쿼리 에러를 중앙 집중식으로 처리 (Server Components)
      onError: (error) => handleAppError(error),
    }),
    mutationCache: new MutationCache({
      // 모든 mutation 에러를 중앙 집중식으로 처리 (Client Components)
      // meta.skipGlobalError가 true이면 전역 에러 핸들링 건너뛰기 (로컬 onError에서 처리)
      onError: (error, _variables, _context, mutation) => {
        if (mutation.meta?.skipGlobalError) return;
        handleAppError(error);
      },
    }),
    defaultOptions: {
      queries: {
        // 네트워크 일시적 오류 대응 (2회 재시도)
        retry: 2,
        // 지수 백오프: 1초 → 2초 → 4초 (최대 30초)
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
        refetchOnWindowFocus: false,
        staleTime: 1000 * 60 * 5, // 5분
      },
      mutations: {
        // mutation은 기본적으로 재시도 안 함 (멱등성 보장 X, 중복 생성 방지)
        // 필요시 개별 mutation에서 retry 옵션 오버라이드
        retry: 0,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined = undefined;

// 2. 환경에 따라 QueryClient 인스턴스를 반환하는 함수 (else 문 제거)
function getQueryClient() {
  // Server: SSR/RSC 요청 시마다 새로운 인스턴스 생성
  if (typeof window === 'undefined') {
    return makeQueryClient();
  }

  // Browser: 브라우저에 단 하나의 인스턴스만 생성 및 재사용
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {children}
        <Toaster
          position="top-center"
          offset="calc(var(--header-h) + 2rem)"
          toastOptions={{ unstyled: true }}
        />
      </AuthProvider>
    </QueryClientProvider>
  );
}

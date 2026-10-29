/**
 * AuthProvider.tsx
 * 앱 전체에 인증 상태 리스너를 적용하는 Provider 컴포넌트
 */

'use client';

import React from 'react';
import { useAuthListener } from '../hooks/useAuthListener';

interface AuthProviderProps {
  children: React.ReactNode;
}

/**
 * 인증 상태를 전역적으로 관리하는 Provider 컴포넌트
 *
 * ## 역할
 * - useAuthListener 훅을 실행하여 Supabase 인증 상태를 실시간 모니터링
 * - 로그인/로그아웃 이벤트를 감지하여 Zustand 스토어 자동 업데이트
 * - 새로고침 시에도 쿠키의 세션을 읽어 인증 상태 복원
 *
 * ## 사용 위치
 * - 루트 레이아웃의 Providers 컴포넌트 내부
 * - QueryClientProvider와 함께 사용
 *
 * @example
 * ```tsx
 * <Providers>
 *   <AuthProvider>
 *     {children}
 *   </AuthProvider>
 * </Providers>
 * ```
 */
export function AuthProvider({ children }: AuthProviderProps) {
  // Supabase 인증 상태 리스너 활성화
  useAuthListener();

  // Provider는 상태를 관리만 하고, children을 그대로 렌더링
  return <>{children}</>;
}

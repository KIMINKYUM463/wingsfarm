/**
 * useAuthListener.ts
 * Supabase의 onAuthStateChange를 사용하여 인증 상태 변화를 실시간으로 감지하고
 * Zustand 스토어와 동기화하는 훅
 *
 * ## SSR 환경에서의 인증 상태 관리
 * - 클라이언트에서는 getSession()을 사용하여 쿠키에서 세션 읽기
 * - 서버에서는 getUser()를 사용하여 검증 (서버 코드에서만)
 * - createBrowserClient는 자동으로 쿠키를 읽어 세션을 관리
 */

import { useEffect } from 'react';
import { getBrowserSupabaseClient } from '@/shared/lib/supabase/client';
import { useAuthStore } from '../store/useAuthStore';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

/**
 * 앱 초기화 시 Supabase 인증 상태를 실시간으로 모니터링하고
 * Zustand 스토어에 자동으로 반영합니다.
 *
 * ## 동작 방식 (SSR 환경 - 쿠키 기반 세션)
 * 1. 컴포넌트 마운트 시 getSession()으로 쿠키에서 세션 읽기
 * 2. onAuthStateChange로 로그인/로그아웃 이벤트 감지
 * 3. 인증 상태 변화 시 세션의 user 정보를 Zustand 스토어에 업데이트
 * 4. 컴포넌트 언마운트 시 리스너 정리
 *
 * ## SSR 환경 특성
 * - createBrowserClient는 자동으로 쿠키를 읽어 세션 관리
 * - getSession()은 쿠키에서 세션을 안전하게 읽음 (클라이언트에서 사용 안전)
 * - 서버에서는 getUser()를 사용하여 검증해야 함 (이 훅은 클라이언트 전용)
 *
 * ## 사용 위치
 * - AuthProvider 컴포넌트에서 한 번만 호출
 * - 앱의 최상위 레벨에서 실행되어 전역 인증 상태 관리
 */
export function useAuthListener() {
  const { setUser, clearUser } = useAuthStore();

  useEffect(() => {
    const supabase = getBrowserSupabaseClient();
    let isInitialized = false;

    // 초기 인증 상태 확인 및 설정 (마운트 시 한 번만)
    const initializeAuth = async () => {
      if (isInitialized) return;
      isInitialized = true;

      // 클라이언트에서는 getSession()으로 쿠키에서 세션 읽기
      // SSR 환경에서 createBrowserClient는 자동으로 쿠키를 읽어 세션을 관리
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        clearUser();
        return;
      }

      setUser(session.user);
    };

    // 인증 상태 변화 핸들러
    const handleAuthChange = async (event: AuthChangeEvent, session: Session | null) => {
      // 로그아웃 이벤트 명시적 처리
      if (event === 'SIGNED_OUT' || !session) {
        clearUser();
        return;
      }

      // 로그인/토큰 갱신 이벤트: 세션에서 user 정보 업데이트
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        if (!session?.user) {
          clearUser();
          return;
        }

        setUser(session.user);
        return;
      }
    };

    // 초기화 및 리스너 등록
    initializeAuth();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(handleAuthChange);

    // 클린업
    return () => {
      subscription.unsubscribe();
      isInitialized = false;
    };
  }, [setUser, clearUser]);
}

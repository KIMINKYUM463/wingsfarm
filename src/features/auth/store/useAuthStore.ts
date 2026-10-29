/**
 * src/store/useAuthStore.ts
 * Supabase 리스너와 연결되는 클라이언트 전역 인증 상태 스토어 (persist 제거)
 */
import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';

interface AuthState {
  /** 현재 인증된 사용자 정보 (클라이언트 메모리에서만 관리) */
  user: User | null;
  /** 사용자 객체 유무로 로그인 상태를 판단 (UI 반응성을 위해 사용) */
  isSignin: boolean;

  setUser: (user: User) => void;
  clearUser: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isSignin: false,

  setUser: (user) => set({ user, isSignin: true }),

  clearUser: () => set({ user: null, isSignin: false }),
}));

// 이 스토어는 이제 로컬 저장소에 저장되지 않으며,
// Supabase 리스너(useAuthListener)를 통해 새로고침 시 상태를 복구합니다.

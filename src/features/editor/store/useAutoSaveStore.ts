import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { KonvaFrameElement } from '@/shared/types/konva';

/**
 * 자동 저장 상태 타입
 * - idle: 초기 상태 / 대기
 * - pending: 디바운스 대기 중 (저장 예정)
 * - saving: 저장 API 호출 중
 * - saved: 저장 완료
 * - error: 저장 실패
 */
export type AutoSaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

/**
 * 자동 저장 상태 관리 스토어
 *
 * ## 책임
 * - 저장 상태 추적 (idle/saving/saved/error)
 * - 마지막 저장 시간 기록
 * - 에러 메시지 관리
 * - 저장 활성화/비활성화 제어
 * - 수동 저장 콜백 등록/호출
 * - CRUD 작업 후 refs 업데이트 (중복 저장 방지)
 */
interface AutoSaveState {
  // 상태
  status: AutoSaveStatus;
  lastSavedAt: Date | null;
  error: string | null;
  enabled: boolean;
  saveCallback: (() => Promise<boolean>) | null;
  /** CRUD 완료 후 autoSave refs에 등록할 프레임 (중복 저장 방지) */
  frameToRegister: KonvaFrameElement | null;

  // Actions
  setStatus: (status: AutoSaveStatus) => void;
  setPending: () => void;
  setSaving: () => void;
  setSaved: () => void;
  setError: (error: string) => void;
  setEnabled: (enabled: boolean) => void;
  setSaveCallback: (callback: (() => Promise<boolean>) | null) => void;
  /** CRUD 완료 후 호출하여 autoSave refs에 프레임 등록 */
  registerSavedFrame: (frame: KonvaFrameElement) => void;
  reset: () => void;
}

export const useAutoSaveStore = create<AutoSaveState>()(
  devtools(
    (set) => ({
      // Initial state
      status: 'idle',
      lastSavedAt: null,
      error: null,
      enabled: true,
      saveCallback: null,
      frameToRegister: null,

      // Actions
      setStatus: (status: AutoSaveStatus) => {
        set({ status });
      },

      setPending: () => {
        set({ status: 'pending', error: null });
      },

      setSaving: () => {
        set({ status: 'saving', error: null });
      },

      setSaved: () => {
        set({
          status: 'saved',
          lastSavedAt: new Date(),
          error: null,
        });
      },

      setError: (error: string) => {
        set({ status: 'error', error });
      },

      setEnabled: (enabled: boolean) => {
        set({ enabled });
      },

      setSaveCallback: (callback: (() => Promise<boolean>) | null) => {
        set({ saveCallback: callback });
      },

      registerSavedFrame: (frame) => {
        set({ frameToRegister: frame });
      },

      reset: () => {
        set({
          status: 'idle',
          lastSavedAt: null,
          error: null,
          enabled: true,
          saveCallback: null,
          frameToRegister: null,
        });
      },
    }),
    { name: 'auto-save-store' },
  ),
);

// 셀렉터 함수들
export const useAutoSaveStatus = () => useAutoSaveStore((state) => state.status);
export const useAutoSaveLastSavedAt = () => useAutoSaveStore((state) => state.lastSavedAt);
export const useAutoSaveError = () => useAutoSaveStore((state) => state.error);
export const useAutoSaveEnabled = () => useAutoSaveStore((state) => state.enabled);

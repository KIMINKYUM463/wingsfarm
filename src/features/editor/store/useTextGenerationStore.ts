import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

/**
 * AI 텍스트 생성 상태 저장소
 *
 * ## 책임
 * - AI로 생성된 텍스트 로딩 상태 관리
 * - 텍스트 요소 직접 업데이트 (참조 유지)
 *
 * ## 분리 이유
 * - 캔버스 데이터와 독립적인 생명주기
 * - AI 기능의 독립적 관리 및 확장
 * - 단일 책임 원칙(SRP) 준수
 */
interface TextGenerationState {
  // 텍스트 로딩 상태 맵 (elementId -> isLoading)
  textLoadingStates: Map<string, boolean>;

  // 텍스트 로딩 상태 설정
  setTextLoading: (elementId: string, isLoading: boolean) => void;
  // 상태 초기화
  reset: () => void;
}

export const useTextGenerationStore = create<TextGenerationState>()(
  devtools(
    (set, get) => ({
      textLoadingStates: new Map(),

      setTextLoading: (elementId: string, isLoading: boolean) => {
        const { textLoadingStates } = get();
        const newMap = new Map(textLoadingStates);
        newMap.set(elementId, isLoading);
        set({ textLoadingStates: newMap });
      },

      reset: () => {
        set({
          textLoadingStates: new Map(),
        });
      },
    }),
    { name: 'text-generation-store' },
  ),
);

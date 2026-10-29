import { useAutoSaveStore } from '@/features/editor/store/useAutoSaveStore';
import { showToast } from '@/utils/toast';

/**
 * 수동 저장 훅
 *
 * ## 책임
 * - 수동 저장 버튼 클릭 처리
 * - 저장 콜백 실행
 * - 토스트 메시지 표시
 *
 * ## 반환값
 * - `handleSave`: 저장 함수
 * - `canSave`: 저장 가능 여부 (콜백 등록 여부)
 *
 * ## 사용 예시
 * ```tsx
 * const { handleSave, canSave } = useManualSave();
 *
 * <button onClick={handleSave} disabled={!canSave}>
 *   저장
 * </button>
 * ```
 */
export const useManualSave = () => {
  const saveCallback = useAutoSaveStore((state) => state.saveCallback);

  const handleSave = async () => {
    // 저장 콜백이 없으면 early return
    if (!saveCallback) {
      console.warn('[useManualSave] 저장 콜백이 등록되지 않았습니다');
      return;
    }

    // 저장 실행
    try {
      await saveCallback();
    } catch (error) {
      console.error('[useManualSave] 저장 실패:', error);
      showToast.warn('저장 기능을 사용할 수 없습니다');
    }
  };

  return {
    handleSave,
    canSave: saveCallback !== null,
    isDisabled: saveCallback === null,
  };
};

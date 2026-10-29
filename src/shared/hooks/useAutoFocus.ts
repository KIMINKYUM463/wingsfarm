import { useEffect } from 'react';
import { UseFormSetFocus, FieldValues, Path } from 'react-hook-form';

/**
 * 폼 필드에 자동 포커스를 설정하는 훅
 *
 * @param setFocus - react-hook-form의 setFocus 함수
 * @param fieldName - 포커스를 설정할 필드 이름
 * @param enabled - 자동 포커스 활성화 여부 (기본값: true)
 *
 * @example
 * const { setFocus } = useForm();
 * useAutoFocus(setFocus, 'email');
 */
export const useAutoFocus = <TFieldValues extends FieldValues>(
  setFocus: UseFormSetFocus<TFieldValues>,
  fieldName: Path<TFieldValues>,
  enabled = true
) => {
  useEffect(() => {
    if (enabled) {
      // 약간의 딜레이를 주어 DOM이 완전히 렌더링된 후 포커스 설정
      const timer = setTimeout(() => {
        setFocus(fieldName);
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [setFocus, fieldName, enabled]);
};

import { useEffect, useRef, useState } from 'react';
import Input from '@/shared/ui/Input/Input';
import clsx from 'clsx';

interface NumericInputFieldProps {
  label: string;
  /** 제어 모드: 외부 값 변경 시 반영됨 */
  value?: number;
  /** 비제어 모드: 초기값만 설정 (value와 함께 사용 시 value 우선) */
  defaultValue?: number;
  suffix?: '%' | 'px' | string;
  /** 매 입력마다 호출 (기존 사용처용) */
  onChange?: (value: number) => void;
  /** Enter/blur 시에만 호출 (프레임 높이 변경 등) */
  onCommit?: (value: number) => void;
  /** 최소값 (미만이면 최소값으로 클램핑) */
  min?: number;
  /** 최대값 (초과하면 최대값으로 클램핑) */
  max?: number;
  className?: string;
}

const NumericInputField = ({
  label,
  value: controlledValue,
  defaultValue = 0,
  suffix,
  onChange,
  onCommit,
  min,
  max,
  className,
}: NumericInputFieldProps) => {
  // 제어 모드 여부 (value prop이 있으면 제어 모드)
  const isControlled = controlledValue !== undefined;
  const initialValue = controlledValue ?? defaultValue;

  // 내부 상태 (입력 중인 값)
  const [internalValue, setInternalValue] = useState(initialValue);
  // 포커스 상태 (포커스 중에는 외부 값 변경 무시)
  const isFocusedRef = useRef(false);

  // 제어 모드: 외부 값 변경 시 내부 상태 동기화 (포커스 중이 아닐 때만)
  useEffect(() => {
    if (isControlled && !isFocusedRef.current) {
      setInternalValue(controlledValue);
    }
  }, [isControlled, controlledValue]);

  /** 값을 min/max 범위로 클램핑 */
  const clampValue = (value: number): number => {
    if (min !== undefined && value < min) return min;
    if (max !== undefined && value > max) return max;
    return value;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = Number(e.target.value);
    setInternalValue(newValue);
    onChange?.(newValue);
  };

  const handleFocus = () => {
    isFocusedRef.current = true;
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    isFocusedRef.current = false;

    const rawValue = Number(e.target.value);
    // 유효하지 않은 값이면 원래 값으로 복원
    if (isNaN(rawValue)) {
      setInternalValue(initialValue);
      return;
    }
    // min/max 클램핑
    const clampedValue = clampValue(rawValue);
    setInternalValue(clampedValue);

    if (onCommit) {
      // 변경 없으면 스킵
      if (clampedValue === initialValue) return;
      onCommit(clampedValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.currentTarget.blur();
      return;
    }
    if (e.key === 'Escape') {
      setInternalValue(initialValue);
      e.currentTarget.blur();
    }
  };

  return (
    <div className={clsx("form-point flex items-center justify-between focus-within:border-(--color-point)", className)}>
      <p className="shrink-0 pr-2">{label}</p>
      <Input
        type="number"
        className="p flex-1 text-right bg-transparent focus:outline-none min-w-0"
        value={internalValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
      />
      {suffix && <span className="title-1 shrink-0">{suffix}</span>}
    </div>
  );
};

export default NumericInputField;

import IconButton from '@/shared/ui/Button/IconButton';
import Input from '@/shared/ui/Input/Input';
import clsx from 'clsx';
import React, { useState, useEffect } from 'react';

const DEFAULT_SIZE = 24;
const MIXED_PLACEHOLDER = '-';

interface CommonSizeProps {
  /** undefined면 혼합 상태 → "-" 표시 */
  initialValue?: number;
  onChange?: (value: number) => void;
  className?: string;
  /** 최소값 (기본값: 1) */
  min?: number;
  /** 최대값 (기본값: 999) */
  max?: number;
}

const CommonSize = ({
  initialValue,
  onChange,
  className,
  min = 1,
  max = 999,
}: CommonSizeProps) => {
  // null = 혼합 상태 (다중 선택 시 값이 다름)
  const [value, setValue] = useState<number | null>(initialValue ?? null);

  useEffect(() => {
    setValue(initialValue ?? null);
  }, [initialValue]);

  const handleDecrease = () => {
    // 혼합 상태면 기본값에서 시작
    const currentValue = value ?? DEFAULT_SIZE;
    const newValue = Math.max(min, currentValue - 1);
    setValue(newValue);
    onChange?.(newValue);
  };

  const handleIncrease = () => {
    // 혼합 상태면 기본값에서 시작
    const currentValue = value ?? DEFAULT_SIZE;
    const newValue = Math.min(max, currentValue + 1);
    setValue(newValue);
    onChange?.(newValue);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = parseInt(e.target.value);
    // 빈 값이나 NaN이면 min으로 설정
    const parsedValue = isNaN(inputValue) ? min : inputValue;
    const clampedValue = Math.max(min, Math.min(max, parsedValue));
    setValue(clampedValue);
    onChange?.(clampedValue);
  };

  return (
    <div className={clsx('btn-editor-wrap', className)}>
      <IconButton
        type="button"
        className="btn-editor min-w-(--btn-h)"
        onClick={handleDecrease}
        icon="check_indeterminate_small"
      />
      <Input
        type="number"
        value={value ?? ''}
        placeholder={value === null ? MIXED_PLACEHOLDER : undefined}
        onChange={handleInputChange}
        className="w-full h-full text-center focus:border px-2 focus:border-(--color-point) focus:outline-none"
      />
      <IconButton
        type="button"
        className="btn-editor min-w-(--btn-h)"
        onClick={handleIncrease}
        icon="add"
        iconColor="black"
      />
    </div>
  );
};

export default CommonSize;

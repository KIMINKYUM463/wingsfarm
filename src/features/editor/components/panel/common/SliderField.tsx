import RangeInput from '@/shared/ui/RangeInput';
import ToolFormLayout from '@/features/editor/components/panel/common/ToolFormLayout';
import React, { useState } from 'react';

interface SliderFieldProps {
  min?: number;
  max?: number;
  value?: number; // 외부에서 제어하는 값
  defaultValue?: number; // 초기값 (value가 없을 때만 사용)
  step?: number;
  title: string;
  onChange?: (value: number) => void;
}
const SliderField = ({
  min = 0,
  max = 100,
  value,
  defaultValue = 0,
  step = 1,
  title,
  onChange,
}: SliderFieldProps) => {
  const [internalValue, setInternalValue] = useState(defaultValue);

  // 외부에서 value를 제공하면 그것을 사용, 아니면 내부 상태 사용
  const currentValue = value !== undefined ? value : internalValue;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = Number(e.target.value);

    // 외부에서 value를 제어하지 않을 때만 내부 상태 업데이트
    if (value === undefined) {
      setInternalValue(newValue);
    }

    onChange?.(newValue);
  };

  return (
    <ToolFormLayout title={title} suffix="%" figure={currentValue}>
      <RangeInput min={min} max={max} step={step} value={currentValue} onChange={handleChange} />
    </ToolFormLayout>
  );
};

export default SliderField;

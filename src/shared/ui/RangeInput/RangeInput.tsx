import React, { forwardRef } from 'react';

interface RangeInputProps {
  min?: number;
  max?: number;
  step?: number;
  value: number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
}

const RangeInput = forwardRef<HTMLInputElement, RangeInputProps>(
  ({ min = 0, max = 100, step = 1, value, onChange, className = '' }, ref) => {
    return (
      <div className={`relative w-full grid items-center ${className}`}>
        {/* 💡 1. 맨 뒤에 깔릴 전체 트랙 (회색 배경) */}
        <div className="w-full h-[1.5px] bg-gray-100 col-start-1 row-start-1" />

        {/* 2. 그 위에 쌓일 진행률 바 (포인트 색상) */}
        <div
          className="h-[1.5px] bg-(--color-point) pointer-events-none col-start-1 row-start-1"
          style={{ width: `${((value - min) / (max - min)) * 100}%` }}
        />

        {/* 3. 맨 위에 올라올 슬라이더 Input (상호작용 담당) */}
        <input
          ref={ref}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={onChange}
          className="w-full h-auto bg-transparent appearance-none cursor-pointer col-start-1 row-start-1
          [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:w-3
          [&::-webkit-slider-thumb]:h-3
          [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:bg-white
          [&::-webkit-slider-thumb]:cursor-pointer
          [&::-webkit-slider-thumb]:border
          [&::-webkit-slider-thumb]:border-gray-100
          [&::-moz-range-thumb]:w-3
          [&::-moz-range-thumb]:h-3
          [&::-moz-range-thumb]:rounded-full
          [&::-moz-range-thumb]:bg-white
          [&::-moz-range-thumb]:cursor-pointer
          [&::-moz-range-thumb]:border
          [&::-moz-range-thumb]:border-gray-100
          "
        />
      </div>
    );
  },
);

RangeInput.displayName = 'RangeInput';

export default RangeInput;

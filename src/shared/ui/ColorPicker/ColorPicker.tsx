'use client';

import React, { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { ColorInput } from '@/shared/ui/ColorInput';

interface ColorPickerProps {
  initialColor?: string;
  onChange?: (color: string) => void;
  className?: string;
}

/**
 * 순수 Color Picker 컴포넌트 (label 없음)
 * Figma 디자인 기반: size-6, border-gray-200, p-0.5
 */
const ColorPicker: React.FC<ColorPickerProps> = ({
  initialColor = '#000000',
  onChange,
  className,
}) => {
  const [color, setColor] = useState(initialColor);

  // initialColor 변경 감지 (요소 선택 변경 시)
  useEffect(() => {
    setColor(initialColor);
  }, [initialColor]);

  const handleColorChange = (newColor: string) => {
    setColor(newColor);
    onChange?.(newColor);
  };

  return (
    <label
      className={clsx(
        'relative flex-center',
        'size-6 p-0.5',
        'border border-gray-200',
        'rounded',
        'cursor-pointer',
        className,
      )}
    >
      {/* 색상 표시 - 흰색일 때만 테두리 추가 */}
      <div
        className={clsx(
          'size-full shrink-0 rounded-sm',
          color.toLowerCase() === '#ffffff' && 'border border-gray-200',
        )}
        style={{ backgroundColor: color }}
      />

      {/* Color input (투명 오버레이) */}
      <ColorInput
        value={color}
        onChange={handleColorChange}
        className="absolute inset-0 size-full opacity-0"
      />
    </label>
  );
};

export default ColorPicker;

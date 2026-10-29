'use client';

import React, { useRef, useState } from 'react';
import Button from '@/shared/ui/Button/Button';
import CustomIcon from '@/shared/ui/CustomIcon';
import ActionTooltip from '@/shared/ui/Tooltip/ActionTooltip';
import { ColorInputWithRef, type ColorInputHandle } from '@/shared/ui/ColorInput';
import clsx from 'clsx';

// 색상 값을 hex 값으로 변환하는 유틸리티 함수
const toHexColor = (color: string): string => {
  // 이미 hex 값이면 정규화하여 반환
  if (color.startsWith('#')) {
    // 3자리 축약형 → 6자리 (#FFF → #FFFFFF)
    if (color.length === 4) {
      return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`;
    }
    return color;
  }

  // rgba(51, 51, 51, 1) 형식을 파싱
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
  if (!match) return '#000000';

  const r = parseInt(match[1], 10);
  const g = parseInt(match[2], 10);
  const b = parseInt(match[3], 10);

  // RGB 값을 16진수로 변환
  const toHex = (n: number) => {
    const hex = n.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

// 색상이 밝은지 확인 (흰색/밝은 색상 → 테두리 필요)
const isLightColor = (color: string): boolean => {
  let hex = toHexColor(color).replace('#', '');
  // 3자리 축약형 hex 처리 (#FFF → #FFFFFF)
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  // 밝기 계산 (YIQ formula)
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 230;
};

interface TextColorPickerProps {
  currentColor: string;
  onColorChange: (color: string) => void;
  /** 현재 배경색 (하이라이트) */
  currentHighlightColor?: string;
  onHighlightChange: (color: string) => void;
  className?: string;
  /** 다중 선택 시 텍스트 색상이 다르면 true */
  isMixed?: boolean;
  /** 다중 선택 시 배경색이 다르면 true */
  isHighlightMixed?: boolean;
}

const MIXED_GRADIENT = 'linear-gradient(90deg, #FF6B6B, #4ECDC4, #45B7D1, #96CEB4, #FFEAA7)';

const TextColorPicker: React.FC<TextColorPickerProps> = ({
  currentColor,
  onColorChange,
  currentHighlightColor,
  onHighlightChange,
  className = '',
  isMixed = false,
  isHighlightMixed = false,
}) => {
  const colorInputRef = useRef<ColorInputHandle>(null);
  const highlightInputRef = useRef<ColorInputHandle>(null);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [isHighlightPickerOpen, setIsHighlightPickerOpen] = useState(false);

  const handleColorButtonClick = () => {
    colorInputRef.current?.open();
  };

  const handleHighlightButtonClick = () => {
    highlightInputRef.current?.open();
  };

  return (
    <div className={clsx('btn-editor-wrap', className)}>
      {/* 텍스트 색상 버튼 */}
      <ActionTooltip content="글자 색상" direction="top">
        <Button
          type="button"
          className={clsx('btn-editor flex-1 relative', { active: isColorPickerOpen })}
          onClick={handleColorButtonClick}
        >
        <div className="relative">
          <CustomIcon
            name="text-under-line"
            width={24}
            height={24}
            style={{ color: isMixed ? '#666' : currentColor }}
          />
          {/* 색상 바 오버레이 (혼합 시 그라데이션, 밝은 색상 시 테두리) */}
          {(isMixed || isLightColor(currentColor)) && (
            <div
              className={clsx(
                'absolute rounded-full pointer-events-none',
                !isMixed && isLightColor(currentColor) && 'border border-gray-200',
              )}
              style={{
                left: 4,
                top: 17.5,
                width: 16,
                height: 4,
                background: isMixed ? MIXED_GRADIENT : 'transparent',
              }}
            />
          )}
        </div>
        <ColorInputWithRef
          ref={colorInputRef}
          value={toHexColor(currentColor)}
          onChange={onColorChange}
          onOpenChange={setIsColorPickerOpen}
          className="absolute inset-0 w-full h-full opacity-0"
        />
      </Button>
      </ActionTooltip>

      {/* 하이라이터 버튼 */}
      <ActionTooltip content="배경 색상" direction="top">
        <Button
          type="button"
          className={clsx('btn-editor flex-1 relative', { active: isHighlightPickerOpen })}
          onClick={handleHighlightButtonClick}
        >
        <div className="relative">
          <CustomIcon
            name="ink_highlighter"
            width={21}
            height={24}
            style={{ color: isHighlightMixed ? '#666' : currentHighlightColor }}
          />
          {/* 색상 바 오버레이 (혼합 시 그라데이션, 밝은 색상 시 테두리) */}
          {(isHighlightMixed || (currentHighlightColor && isLightColor(currentHighlightColor))) && (
            <div
              className={clsx(
                'absolute rounded-full pointer-events-none',
                !isHighlightMixed && currentHighlightColor && isLightColor(currentHighlightColor) && 'border border-gray-200',
              )}
              style={{
                left: 2,
                bottom: 2,
                width: 17,
                height: 4,
                background: isHighlightMixed ? MIXED_GRADIENT : 'transparent',
              }}
            />
          )}
        </div>
        <ColorInputWithRef
          ref={highlightInputRef}
          value={currentHighlightColor ? toHexColor(currentHighlightColor) : '#FFFF00'}
          onChange={onHighlightChange}
          onOpenChange={setIsHighlightPickerOpen}
          className="absolute inset-0 w-full h-full opacity-0"
        />
      </Button>
      </ActionTooltip>
    </div>
  );
};

export default TextColorPicker;

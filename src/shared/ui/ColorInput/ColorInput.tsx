'use client';

import React, { useRef, useCallback, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { HexColorPicker, HexColorInput } from 'react-colorful';
import clsx from 'clsx';

interface ColorInputProps {
  /** 현재 색상 값 (hex) */
  value: string;
  /** 색상 변경 콜백 */
  onChange: (color: string) => void;
  /** 피커 열림 상태 변경 콜백 (선택적) */
  onOpenChange?: (isOpen: boolean) => void;
  /** 추가 클래스 */
  className?: string;
  /** input 스타일 */
  style?: React.CSSProperties;
}

/** 팝오버 크기 (경계 체크용) */
const POPOVER_WIDTH = 200;
const POPOVER_HEIGHT = 250;
const POPOVER_GAP = 8;

/** 팝오버 위치 계산 (화면 경계 체크 포함) */
const getPopoverPosition = (triggerEl: HTMLElement | null) => {
  if (!triggerEl) return { top: 0, left: 0 };

  const rect = triggerEl.getBoundingClientRect();
  let top = rect.bottom + POPOVER_GAP;
  let left = rect.left;

  // 하단 경계 체크: 아래 공간 부족 시 위로
  if (top + POPOVER_HEIGHT > window.innerHeight) {
    top = rect.top - POPOVER_HEIGHT - POPOVER_GAP;
  }

  // 우측 경계 체크: 오른쪽 공간 부족 시 왼쪽으로
  if (left + POPOVER_WIDTH > window.innerWidth) {
    left = window.innerWidth - POPOVER_WIDTH - POPOVER_GAP;
  }

  // 최소 경계 (음수 방지)
  return { top: Math.max(POPOVER_GAP, top), left: Math.max(POPOVER_GAP, left) };
};

/** 색상 피커 팝오버 렌더링 */
const ColorPickerPopover = React.forwardRef<
  HTMLDivElement,
  { value: string; onChange: (color: string) => void; position: { top: number; left: number } }
>(({ value, onChange, position }, ref) => (
  <div
    ref={ref}
    className="fixed z-9999 p-3 bg-white rounded-lg shadow-lg border border-gray-200"
    style={{ top: position.top, left: position.left }}
  >
    <HexColorPicker color={value} onChange={onChange} />
    <div className="mt-2 flex items-center gap-2">
      <span className="text-xs text-gray-500">#</span>
      <HexColorInput
        color={value}
        onChange={onChange}
        className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:border-blue-500"
        prefixed={false}
      />
    </div>
  </div>
));
ColorPickerPopover.displayName = 'ColorPickerPopover';

/** 공통 색상 피커 로직 훅 */
const useColorPicker = (onOpenChange?: (isOpen: boolean) => void) => {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const positionRef = useRef({ top: 0, left: 0 });

  const close = useCallback(() => {
    setIsOpen(false);
    onOpenChange?.(false);
  }, [onOpenChange]);

  const open = useCallback(() => {
    positionRef.current = getPopoverPosition(triggerRef.current);
    setIsOpen(true);
    onOpenChange?.(true);
  }, [onOpenChange]);

  // 외부 클릭 및 ESC 키 감지
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        close();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, close]);

  return { isOpen, open, close, popoverRef, triggerRef, positionRef };
};

/**
 * react-colorful 기반 색상 피커 컴포넌트
 *
 * ## 특징
 * - react-colorful 사용으로 Mac/Windows 일관된 UI
 * - 네이티브 피커 대비 성능 개선 (Windows 11 + Chrome 버벅임 해결)
 * - 클릭 외부 영역 클릭 시 자동 닫힘
 * - HEX 입력 지원
 * - 화면 경계 자동 감지
 */
const ColorInput: React.FC<ColorInputProps> = ({ value, onChange, onOpenChange, className, style }) => {
  const { isOpen, open, close, popoverRef, triggerRef, positionRef } = useColorPicker(onOpenChange);

  const handleToggle = useCallback(() => {
    if (isOpen) close();
    else open();
  }, [isOpen, open, close]);

  return (
    <>
      <div
        ref={triggerRef}
        onClick={handleToggle}
        className={clsx('cursor-pointer', className)}
        style={style}
      />
      {isOpen && createPortal(
        <ColorPickerPopover ref={popoverRef} value={value} onChange={onChange} position={positionRef.current} />,
        document.body,
      )}
    </>
  );
};

export default ColorInput;

/** ColorInput ref 타입 (open 메서드 노출용) */
export interface ColorInputHandle {
  open: () => void;
}

/** forwardRef 버전 - 외부에서 open() 호출 가능 */
export const ColorInputWithRef = React.forwardRef<ColorInputHandle, ColorInputProps>(
  ({ value, onChange, onOpenChange, className, style }, ref) => {
    const { isOpen, open, popoverRef, triggerRef, positionRef } = useColorPicker(onOpenChange);

    React.useImperativeHandle(ref, () => ({ open }), [open]);

    return (
      <>
        <div ref={triggerRef} className={clsx('size-full', className)} style={style} />
        {isOpen && createPortal(
          <ColorPickerPopover ref={popoverRef} value={value} onChange={onChange} position={positionRef.current} />,
          document.body,
        )}
      </>
    );
  },
);

ColorInputWithRef.displayName = 'ColorInputWithRef';

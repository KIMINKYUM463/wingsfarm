'use client';

import { createPortal } from 'react-dom';
import { ReactNode } from 'react';

export interface TooltipPosition {
  x: number;
  y: number;
}

interface PositionedTooltipProps {
  position: TooltipPosition;
  children: ReactNode;
  className?: string;
}

const PositionedTooltip = ({ position, children, className = '' }: PositionedTooltipProps) => {
  return createPortal(
    <div
      className={`description fixed z-9999 rounded-md bg-gray-900 text-white animate-[tooltip-fade-in_150ms_ease-out] ${className}`}
      style={{ left: position.x + 8, top: position.y }}
    >
      {children}
    </div>,
    document.body,
  );
};

export default PositionedTooltip;

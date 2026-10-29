'use client';

import React from 'react';
import { clsx } from 'clsx';

export interface ShapeItem {
  id: string;
  name: string | null;
  preview?: React.ReactNode;
  isSelected?: boolean;
}

interface ShapeItemGridProps {
  items: ShapeItem[];
  onItemClick: (item: ShapeItem) => void;
  className?: string;
}

/**
 * Shape Item Grid Component
 *
 * 요소(Shape) 패널에서 사용하는 3열 ß고정 그리드 레이아웃
 */
const ShapeItemGrid: React.FC<ShapeItemGridProps> = ({ items, onItemClick, className }) => {
  return (
    <div className={clsx('grid grid-cols-3 gap-2.75', className)}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onItemClick(item)}
          className={clsx(
            'relative w-25 h-25.5 rounded-lg bg-gray-50 overflow-hidden',
            'cursor-pointer transition-all duration-100',
            'hover:outline-2 hover:-outline-offset-2 hover:outline-(--color-point)',
            item.isSelected && 'ring-2 ring-blue-500',
          )}
        >
          <div className="absolute inset-2 flex items-center justify-center">
            {item.preview ? item.preview : <span className="text-xs text-gray-400">{item.name ?? ''}</span>}
          </div>
        </button>
      ))}
    </div>
  );
};

export default ShapeItemGrid;

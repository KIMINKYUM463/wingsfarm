'use client';

import { useState } from 'react';
import clsx from 'clsx';
import Icon from '@/shared/ui/Icon';
import Button from '@/shared/ui/Button/Button';

interface Option {
  id: string;
  label: string;
}

interface ToggleSelectGroupProps {
  title?: string;
  options: Option[];
  maxSelectCount?: number;
  /** 초기 선택 값 (리마운트 시 상태 복원용) */
  defaultValue?: string[];
  onChange?: (selectedIds: string[]) => void;
}

const ToggleSelectGroup = ({
  title,
  options,
  maxSelectCount,
  defaultValue = [],
  onChange,
}: ToggleSelectGroupProps) => {
  const [selectedIds, setSelectedIds] = useState<string[]>(defaultValue);
  const [isExpanded, setIsExpanded] = useState(defaultValue.length > 0);

  const handleToggle = (id: string) => {
    const newSelectedIds = selectedIds.includes(id)
      ? selectedIds.filter((selectedId) => selectedId !== id)
      : [...selectedIds, id];

    setSelectedIds(newSelectedIds);
    onChange?.(newSelectedIds);
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <Button
        justify="between"
        onClick={() => setIsExpanded(!isExpanded)}
        className={clsx(
          isExpanded ? 'border-(--color-point)' : 'border-gray-100',
          'border rounded-lg px-4 py-2.25 w-full',
        )}
      >
        <p>{title}</p>
        <div className="flex items-center gap-2">
          {selectedIds.length > 0 && (
            <span className="description text-(--color-point)">{selectedIds.length}개 선택</span>
          )}
          {isExpanded ? <Icon name="keyboard_arrow_up" /> : <Icon name="keyboard_arrow_down" />}
        </div>
      </Button>

      {/* Options */}
      {isExpanded && (
        <div className="flex flex-wrap gap-3">
          {options.map((option) => {
            const isSelected = selectedIds.includes(option.id);
            return (
              <Button
                key={option.id}
                type="button"
                onClick={() => handleToggle(option.id)}
                className={clsx(
                  'px-2.5 py-2 rounded-lg transition-colors',
                  'description text-gray-400',
                  isSelected ? 'bg-(--color-point) text-white' : 'bg-gray-50 hover:bg-gray-50',
                )}
              >
                {option.label}
              </Button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ToggleSelectGroup;

'use client';

import { useEffect, useState } from 'react';
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
  /** 비제어 초기값 (리마운트 시 복원) */
  defaultValue?: string[];
  /** 제어 선택값 — AI 판단 등으로 외부에서 바꿀 때 사용 */
  value?: string[];
  onChange?: (selectedIds: string[]) => void;
}

const ToggleSelectGroup = ({
  title,
  options,
  maxSelectCount,
  defaultValue = [],
  value,
  onChange,
}: ToggleSelectGroupProps) => {
  const isControlled = value !== undefined;
  const [internalSelected, setInternalSelected] = useState<string[]>(defaultValue);
  const selectedIds = isControlled ? value : internalSelected;
  const [isExpanded, setIsExpanded] = useState((value ?? defaultValue).length > 0);

  // 제어 모드: 외부에서 선택이 들어오면(AI 판단) 펼쳐서 보여 줌
  useEffect(() => {
    if (isControlled && value.length > 0) setIsExpanded(true);
  }, [isControlled, value]);

  const handleToggle = (id: string) => {
    const next = selectedIds.includes(id)
      ? selectedIds.filter((selectedId) => selectedId !== id)
      : maxSelectCount && !selectedIds.includes(id) && selectedIds.length >= maxSelectCount
        ? selectedIds
        : [...selectedIds, id];

    if (!isControlled) setInternalSelected(next);
    onChange?.(next);
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <Button
        type="button"
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

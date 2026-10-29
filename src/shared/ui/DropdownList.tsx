'use client';

import clsx from 'clsx';
import { forwardRef, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';

export interface DropdownOption {
  id: string;
  label: string;
}

interface DropdownListProps<T extends DropdownOption> {
  options: T[];
  selectedId?: string;
  onItemClick: (e: ReactMouseEvent, id: string) => void;
  className?: string;
  renderOption?: (option: T, isSelected: boolean) => ReactNode;
  emptyMessage?: string;
}

const DropdownListInner = <T extends DropdownOption>(
  {
    options,
    selectedId,
    onItemClick,
    className,
    renderOption,
    emptyMessage = '검색 결과가 없습니다',
  }: DropdownListProps<T>,
  ref: React.ForwardedRef<HTMLUListElement>,
) => {
  if (options.length === 0) {
    return (
      <ul ref={ref} className={className}>
        <li className="dropdown-item">{emptyMessage}</li>
      </ul>
    );
  }

  return (
    <ul ref={ref} className={className}>
      {options.map((option) => {
        const isSelected = selectedId === option.id;
        return (
          <li
            key={option.id}
            onClick={(e) => onItemClick(e, option.id)}
            className={clsx('dropdown-item', isSelected && 'selected')}
          >
            {renderOption ? renderOption(option, isSelected) : <p>{option.label}</p>}
          </li>
        );
      })}
    </ul>
  );
};

const DropdownList = forwardRef(DropdownListInner) as <T extends DropdownOption>(
  props: DropdownListProps<T> & { ref?: React.ForwardedRef<HTMLUListElement> },
) => React.ReactElement | null;

export default DropdownList;

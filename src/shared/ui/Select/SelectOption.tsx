'use client';
import React, { memo } from 'react';
import { clsx } from 'clsx';
import { SelectOptionProps } from '@/shared/types/ui';

const SelectOption: React.FC<SelectOptionProps> = ({
  id,
  label,
  disabled = false,
  className,
  ...props
}) => {
  return (
    <option value={id} disabled={disabled} className={clsx('bottom-0', className)} {...props}>
      {label}
    </option>
  );
};

// React.memo를 사용하여 props가 변경되지 않으면 리렌더링을 방지합니다.
export default memo(SelectOption);

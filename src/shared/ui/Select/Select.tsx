'use client';
import React from 'react';
import { clsx } from 'clsx';
import SelectOption from './SelectOption';
import { SelectProps } from '@/shared/types/ui';

const Select: React.FC<SelectProps> = ({ options, value, onChange, className, ...props }) => {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={onChange}
        className={clsx('form-single', className)}
        {...props}
      >
        {options.map((option) => (
          <SelectOption
            key={option.id}
            id={option.id}
            label={option.label}
            disabled={option.disabled}
          />
        ))}
      </select>
    </div>
  );
};

export default Select;

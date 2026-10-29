import clsx from 'clsx';
import React, { ReactNode } from 'react';

type RadioProps = React.DetailedHTMLProps<
  React.InputHTMLAttributes<HTMLInputElement>,
  HTMLInputElement
> & {
  children?: ReactNode;
  labelClassName?: string;
  value: string;
  name: string;
};

const Radio = React.memo(
  React.forwardRef<HTMLInputElement, RadioProps>(
    ({ children, className, labelClassName, value, name, ...props }, ref) => {
      return (
        <label className={clsx(labelClassName, 'cursor-pointer')}>
          <input
            type="radio"
            ref={ref}
            value={value}
            name={name}
            {...props}
            className={clsx(className)}
          />
          {children}
        </label>
      );
    },
  ),
);

Radio.displayName = 'Radio';

export default Radio;

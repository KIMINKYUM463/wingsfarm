import { clsx } from 'clsx';
import { forwardRef } from 'react';
import { ButtonProps } from '@/shared/types/ui';
import Spinner from '@/shared/ui/Spinner/Spinner';

const justifyClass = {
  center: 'justify-center',
  between: 'justify-between',
  start: 'justify-start',
  end: 'justify-end',
} as const;

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { children, className, type = 'button', isLoading, disabled, justify = 'center', ...rest },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        className={clsx(
          'transition flex items-center gap-1',
          justifyClass[justify],
          // 로딩 시 relative + 클릭 방지
          isLoading && 'relative pointer-events-none',
          // disabled: 커서 금지
          disabled && 'cursor-not-allowed',
          className,
        )}
        type={type}
        disabled={disabled}
        {...rest}
      >
        {isLoading ? (
          <>
            {/* 로딩 시 children을 invisible로 유지하여 버튼 너비 보존 */}
            <span className="flex items-center gap-1 invisible" aria-hidden="true">
              {children}
            </span>
            <span className="absolute inset-0 flex-center" role="status" aria-label="로딩 중">
              <Spinner size={24} className="text-white" />
            </span>
          </>
        ) : (
          children
        )}
      </button>
    );
  },
);

Button.displayName = 'Button';

export default Button;

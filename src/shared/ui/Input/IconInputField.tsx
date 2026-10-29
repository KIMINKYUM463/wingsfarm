import React, { forwardRef, ReactNode } from 'react';
import { clsx } from 'clsx';
import Icon from '@/shared/ui/Icon';
import ErrorMessage from '@/shared/ui/ErrorMessage';

interface IconInputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  wrapClassName?: string;
  inputClassName?: string;
  iconName?: string | null;
  customIcon?: ReactNode;
  error?: string;
}

/**
 * 아이콘이 포함된 입력 필드 컴포넌트
 * 아이콘과 에러 메시지를 지원하는 범용 입력 컴포넌트입니다.
 *
 * @example
 * ```tsx
 * // 기본 사용 (검색 아이콘)
 * <IconInputField placeholder="검색..." />
 *
 * // 커스텀 아이콘
 * <IconInputField iconName="email" placeholder="이메일 입력" />
 *
 * // 에러 메시지 포함
 * <IconInputField iconName="lock" error="비밀번호를 입력하세요" />
 * ```
 */
const IconInputField = forwardRef<HTMLInputElement, IconInputFieldProps>(
  ({ wrapClassName, inputClassName, iconName = 'search', customIcon, error, ...rest }, ref) => {
    const hasIcon = iconName !== null && iconName !== undefined;
    const iconElement =
      hasIcon && (customIcon || <Icon name={iconName} className="text-gray-300" />);

    return (
      <>
        <div
          className={clsx(
            'flex h-(--btn-h) items-center px-(--control-x)',
            hasIcon && 'gap-2',
            wrapClassName,
          )}
        >
          {iconElement}
          <input
            ref={ref}
            {...rest}
            className={clsx('w-full', inputClassName)}
            style={{ outline: 'none' }}
            aria-invalid={!!error}
          />
        </div>
        {error && <ErrorMessage message={error} />}
      </>
    );
  },
);

IconInputField.displayName = 'IconInputField';

export default IconInputField;

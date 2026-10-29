import clsx from 'clsx';
import React from 'react';
import Checkbox from './Checkbox';

type LabeledCheckboxProps = Omit<
  React.ComponentProps<typeof Checkbox>,
  'children' | 'className' | 'size'
> & {
  text: string;
  textClassName?: string;
  /**
   * 체크박스 크기 (정사각형, Tailwind 단위)
   * @default 5 (w-5 h-5 = 20px)
   */
  size?: number;
};

/**
 * 텍스트 라벨이 있는 체크박스 컴포넌트
 *
 * @example
 * ```tsx
 * <LabeledCheckbox text="전체선택 (1/6)" />
 * <LabeledCheckbox text="동의합니다" checked={agreed} onChange={handleChange} />
 * <LabeledCheckbox text="동의합니다" size={6} />
 * ```
 */
const LabeledCheckbox = React.memo(
  React.forwardRef<HTMLInputElement, LabeledCheckboxProps>(
    ({ text, textClassName, labelClassName, size = 5, ...props }, ref) => {
      return (
        <Checkbox
          ref={ref}
          labelClassName={clsx('flex items-center gap-2 cursor-pointer', labelClassName)}
          className={`w-${size} h-${size} border border-gray-100`}
          {...props}
        >
          <span className={textClassName}>{text}</span>
        </Checkbox>
      );
    },
  ),
);

LabeledCheckbox.displayName = 'LabeledCheckbox';

export default LabeledCheckbox;

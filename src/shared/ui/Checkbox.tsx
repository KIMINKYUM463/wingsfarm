import Input from '@/shared/ui/Input/Input';
import clsx from 'clsx';
import React, { ReactNode, RefObject } from 'react';

// 체크박스 컴포넌트의 props 타입을 정의합니다.
// 자식 요소를 받을 수 있도록 `ReactNode` 타입을 추가합니다.
type CheckboxProps = React.DetailedHTMLProps<
  React.InputHTMLAttributes<HTMLInputElement>,
  HTMLInputElement
> & {
  children?: ReactNode; // 'label' 대신 'children'을 사용
  labelClassName?: string;
  size?: string;
  /** label 요소에 대한 ref */
  labelRef?: RefObject<HTMLLabelElement | null>;
  /** label 요소의 마우스 진입 이벤트 */
  onMouseEnter?: () => void;
  /** label 요소의 마우스 이탈 이벤트 */
  onMouseLeave?: () => void;
};

// React.memo와 React.forwardRef를 사용하여 최적화 및 ref 전달 기능을 유지합니다.
const Checkbox = React.memo(
  React.forwardRef<HTMLInputElement, CheckboxProps>(
    (
      { children, className, labelClassName, size = 20, labelRef, onMouseEnter, onMouseLeave, ...props },
      ref,
    ) => {
      return (
        <label ref={labelRef} className={labelClassName} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
          <Input
            type="checkbox"
            ref={ref}
            {...props}
            style={{ width: `${size}px`, height: `${size}px` }}
            className={clsx(className, 'border border-gray-100 checked:border-0')}
          />
          {/* input을 숨기고, 실제 체크박스처럼 보이게 할 UI는 CSS로 만듭니다. */}
          {children}
        </label>
      );
    },
  ),
);

Checkbox.displayName = 'Checkbox';

export default Checkbox;

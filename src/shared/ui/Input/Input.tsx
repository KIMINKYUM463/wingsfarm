// import { forwardRef } from 'react';
// import { clsx } from 'clsx';
// import { InputProps } from '@/shared/types/ui';

// const Input = forwardRef<HTMLInputElement, InputProps>(
//   ({ label, error, className, id, ...props }, ref) => {
//     const inputId = id || props.name;

//     return (
//       <input
//         autoComplete="off"
//         id={inputId}
//         ref={ref}
//         style={{ outlineColor: 'var(--color-border)' }}
//         className={clsx('form-single', error && 'border-(--color-danger)', className)}
//         {...props}
//       />
//     );
//   },
// );

// Input.displayName = 'Input';
// export default Input;

import { forwardRef } from 'react';
import { clsx } from 'clsx';
import { InputProps } from '@/shared/types/ui';

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, id, ...props }, ref) => {
    const inputId = id || props.name;

    return <input autoComplete="off" id={inputId} ref={ref} className={className} {...props} />;
  },
);

Input.displayName = 'Input';
export default Input;

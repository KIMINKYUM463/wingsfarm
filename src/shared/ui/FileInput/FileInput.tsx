import clsx from 'clsx';
import { forwardRef, ReactNode } from 'react';

interface FileInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  // 버튼에 표시할 텍스트
  labelText?: string;
  wrapClassName?: string;
  textClassName?: string;
  // 파일이 선택되었을 때 표시할 텍스트 형식 (multiple=true일 때 유용)
  fileSelectedText?: (count: number) => string;
  // 사용자 정의 아이콘을 ReactNode 형태로 받습니다. (추가된 속성)
  icon?: ReactNode;
}

const FileInput = forwardRef<HTMLInputElement, FileInputProps>(
  (
    {
      className,
      wrapClassName,
      accept = 'image/*',
      multiple = false,
      labelText,
      textClassName,
      onChange,
      icon,
      id,
      ...rest
    },
    ref,
  ) => {
    return (
      <div className={wrapClassName}>
        {/* 1. 실제 input (시각적으로 숨김: sr-only 사용) */}
        <input
          ref={ref}
          type="file"
          id={id}
          accept={accept}
          multiple={multiple}
          onChange={onChange}
          // sr-only는 시각적으로는 숨기지만, 스크린 리더 접근성을 유지합니다.
          className="sr-only"
          {...rest}
        />

        {/* 2. 사용자에게 보여지는 버튼 역할의 Label */}
        <label htmlFor={id} className={clsx('flex-center cursor-pointer gap-2', className)}>
          {icon}
          <span className={textClassName}>{labelText}</span>
        </label>
      </div>
    );
  },
);

FileInput.displayName = 'FileInput';

export default FileInput;

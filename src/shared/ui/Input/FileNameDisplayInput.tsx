'use client';
import IconInputField from '@/shared/ui/Input/IconInputField';
import { ReactNode } from 'react';

interface FileNameDisplayInputProps {
  files: File[];
}

// =================================================================
// 제공해주신 FileNameDisplayInput 컴포넌트
// =================================================================
interface FileNameDisplayInputProps {
  files: File[];
  icon?: ReactNode; // 아이콘을 prop으로 받도록 수정
}

const FileNameDisplayInput = ({
  files,
  // icon prop이 없을 경우를 대비해 기본 아이콘을 설정합니다.
  icon = (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5 text-gray-400"
    >
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
    </svg>
  ),
}: FileNameDisplayInputProps) => {
  const getDisplayValue = () => {
    if (files.length === 0) return '';
    if (files.length === 1) return files[0].name;
    return `${files[0].name} 외 ${files.length - 1}개`;
  };

  return (
    <IconInputField
      id="file-name-display"
      name="fileNameDisplay"
      placeholder="선택된 파일이 없습니다."
      value={getDisplayValue()}
      readOnly
      customIcon={icon}
      wrapClassName="bg-gray-50"
      inputClassName="bg-transparent border-none outline-none text-gray-700 cursor-default"
    />
  );
};

export default FileNameDisplayInput;

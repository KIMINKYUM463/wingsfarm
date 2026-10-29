import { SelectHTMLAttributes } from 'react';

/**
 * Select 옵션의 기본 속성
 */
export interface SelectOptionProps {
  /** 옵션의 고유 ID (필수) */
  id: string;
  /** 사용자에게 보이는 텍스트 (필수) */
  label: string;
  /** 옵션을 비활성화할지 여부 */
  disabled?: boolean;
  /** 추가 CSS 클래스 */
  className?: string;
  /** AI로 생성된 옵션 여부 */
  isAiGenerated?: boolean;
}

/**
 * Select 컴포넌트의 기본 속성
 */
export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  /** 선택 가능한 옵션들의 배열 */
  options: SelectOptionProps[];
  /** 현재 선택된 값 */
  value: string;
  /** 값이 변경될 때 호출되는 콜백 함수 */
  onChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  /** 추가 CSS 클래스 */
  className?: string;
}

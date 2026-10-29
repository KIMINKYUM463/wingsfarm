import {
  InputHTMLAttributes,
  TextareaHTMLAttributes,
  ButtonHTMLAttributes,
  ComponentPropsWithoutRef,
} from 'react';

/**
 * Input 컴포넌트의 기본 속성
 */
export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** 라벨 텍스트 */
  label?: string;
  /** 래퍼 컨테이너의 CSS 클래스 */
  /** 에러 메시지 */
  error?: string;
}

/**
 * Button 컴포넌트의 기본 속성
 */
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  // children을 사용하여 콘텐츠의 유연성을 확보
  /**
   * 로딩 상태
   * true일 때 스피너 표시 및 버튼 비활성화
   */
  isLoading?: boolean;
  /**
   * justify 정렬 방식
   * @default 'center'
   */
  justify?: 'center' | 'between' | 'start' | 'end';
}

/**
 * FormLayout 컴포넌트의 기본 속성
 */
export interface FormLayoutProps extends ComponentPropsWithoutRef<'form'> {
  /** 폼 콘텐츠 (제목 포함하여 상위에서 구성) */
  children: React.ReactNode;
}

/**
 * TextArea 컴포넌트의 기본 속성
 */
export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** 추가 CSS 클래스 */
  className?: string;
}

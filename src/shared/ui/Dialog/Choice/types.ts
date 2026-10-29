'use client';

export type ChoiceVariant = 'primary' | 'secondary';

export interface ChoiceItem {
  /** 선택 값 (반환값) */
  value: string;
  /** 버튼 표시 텍스트 */
  label: string;
  /** 버튼 스타일 */
  variant: ChoiceVariant;
}

export interface ChoiceOptions {
  /** 다이얼로그 제목 */
  title: string;
  /** 다이얼로그 설명 (선택) */
  description?: string;
  /** 선택지 목록 (2개) */
  choices: [ChoiceItem, ChoiceItem];
}

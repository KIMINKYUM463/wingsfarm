// ===== Prompt 옵션 =====
export interface PromptOptions {
  /** Prompt 다이얼로그 제목 */
  title: string;
  /** Prompt 다이얼로그 설명 (선택) */
  description?: string;
  /** 입력 필드 placeholder (선택) */
  placeholder?: string;
  /** 입력 필드 초기값 (선택) */
  defaultValue?: string;
  /** 확인 버튼 텍스트 (기본: '확인') */
  confirmText?: string;
  /** 취소 버튼 텍스트 (기본: '취소') */
  cancelText?: string;
}

// ===== Prompt Store 상태 =====
export interface PromptState {
  isOpen: boolean;
  options: PromptOptions | null;
  resolve: ((value: string | null) => void) | null;
}

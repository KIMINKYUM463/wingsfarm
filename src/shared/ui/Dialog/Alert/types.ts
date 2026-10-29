'use client';

import type { ReactNode } from 'react';

// ===== Alert 옵션 =====
export interface AlertOptions {
  /** Alert 제목 */
  title: string;
  /** Alert 설명 (선택) */
  description?: string;
  /** 확인 버튼 텍스트 (기본: '확인') */
  confirmText?: string;
  /** 아이콘 컴포넌트 (선택) */
  icon?: ReactNode;
}

// ===== Alert Store 상태 =====
export interface AlertState {
  isOpen: boolean;
  options: AlertOptions | null;
  resolve: (() => void) | null;
}

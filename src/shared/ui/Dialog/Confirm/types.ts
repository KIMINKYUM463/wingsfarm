'use client';

import type { CustomIconName } from '@/shared/ui/CustomIcon';

// ===== Confirm 옵션 =====
export interface ConfirmOptions {
  /** 확인 다이얼로그 제목 */
  title: string;
  /** 확인 다이얼로그 설명 (선택) */
  description?: string;
  /** 추가 안내 문구 (선택) */
  hint?: string;
  /** X 닫기 버튼 클릭 시 반환값 (기본: false) */
  closeButtonValue?: boolean;
  /** 확인 버튼 텍스트 (기본: '확인') */
  confirmText?: string;
  /** 취소 버튼 텍스트 (기본: '취소') */
  cancelText?: string;
  /** 제목 위에 표시할 아이콘 (선택) */
  icon?: {
    name: CustomIconName;
    width?: number;
    height?: number;
  };
  /** 확인 버튼 로딩 상태 (외부에서 isPending 전달, 선택) */
  isPending?: boolean;
  /** 확인 버튼 클릭 시 콜백 (form submit 전에 실행, 선택) */
  onConfirmClick?: () => void;
}

// ===== Confirm Store 상태 =====
export interface ConfirmState {
  isOpen: boolean;
  options: ConfirmOptions | null;
  resolve: ((value: boolean) => void) | null;
}

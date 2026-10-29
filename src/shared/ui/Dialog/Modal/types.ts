'use client';

import { ComponentType } from 'react';

// ===== 모달 타입 =====
export type ModalType =
  | 'imageUpload'
  | 'aiGuide'
  | 'projectSetup'
  | 'editWarning'
  | 'aiDetailPage'
  | 'productInfo'
  | 'subscriptionPayment'
  | 'paymentComplete'
  | 'paymentReceipt';

// ===== 모달 데이터 (자유로운 형태) =====
export type ModalData = Record<string, unknown> | null | undefined;

// ===== 모달 설정 =====
export interface ModalConfig {
  /** 배경 클릭 시 닫기 (기본: true) */
  closeOnBackdrop?: boolean;
  /** 기본 Backdrop 비활성화 (모달이 자체 배경 사용 시) */
  noBackdrop?: boolean;
}

// ===== 모달 컴포넌트 Props =====
export interface ModalComponentProps {
  data?: ModalData;
  onClose: () => void;
}

// ===== 모달 등록 정보 =====
export interface ModalRegistration {
  component: ComponentType<ModalComponentProps>;
  config: ModalConfig;
}

// ===== 모달 상수 =====
export const MODAL_TYPES = {
  IMAGE_UPLOAD: 'imageUpload',
  AI_GUIDE: 'aiGuide',
  PROJECT_SETUP: 'projectSetup',
  EDIT_WARNING: 'editWarning',
  AI_DETAIL_PAGE: 'aiDetailPage',
  PRODUCT_INFO: 'productInfo',
  SUBSCRIPTION_PAYMENT: 'subscriptionPayment',
  PAYMENT_COMPLETE: 'paymentComplete',
  PAYMENT_RECEIPT: 'paymentReceipt',
} as const;

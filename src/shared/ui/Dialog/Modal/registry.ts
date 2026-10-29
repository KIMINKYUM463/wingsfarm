import { ComponentType } from 'react';
import type { ModalType, ModalComponentProps, ModalConfig, ModalRegistration } from './types';

// 모달 레지스트리 (Map으로 관리)
const modalRegistry = new Map<ModalType, ModalRegistration>();

// 기본 설정 (대부분의 모달은 실수로 닫히면 안 되므로 false)
const DEFAULT_CONFIG: ModalConfig = {
  closeOnBackdrop: false,
};

/**
 * 모달 등록 함수
 * @param type 모달 타입
 * @param component 모달 컴포넌트
 * @param config 모달 설정 (선택)
 */
export function registerModal(
  type: ModalType,
  component: ComponentType<ModalComponentProps>,
  config?: Partial<ModalConfig>
): void {
  modalRegistry.set(type, {
    component,
    config: { ...DEFAULT_CONFIG, ...config },
  });
}

/**
 * 등록된 모달 조회
 * @param type 모달 타입
 * @returns 모달 등록 정보 또는 undefined
 */
export function getModal(type: ModalType): ModalRegistration | undefined {
  return modalRegistry.get(type);
}

/**
 * 모달 등록 여부 확인
 * @param type 모달 타입
 */
export function hasModal(type: ModalType): boolean {
  return modalRegistry.has(type);
}

'use client';

import { useDialog } from '../useDialog';
import { getModal } from './registry';
import { DialogBase } from '../shared';

/**
 * ModalProvider - 글로벌 모달 렌더러
 * - 루트 레이아웃에 배치
 * - 레지스트리에서 모달 컴포넌트 조회 후 렌더링
 * - HTML5 <dialog> 사용 (접근성, ESC 키 네이티브 지원)
 */
const ModalProvider = () => {
  const { modalIsOpen, modalType, modalData, closeModal } = useDialog();

  // 모달 등록 정보 조회
  const registration = modalType ? getModal(modalType) : null;
  const config = registration?.config ?? {};

  // 닫기 가능 여부 확인
  const canCloseOnBackdrop = config.closeOnBackdrop !== false;

  if (!modalType || !registration) return null;

  const ModalComponent = registration.component;

  return (
    <DialogBase
      isOpen={modalIsOpen}
      onClose={closeModal}
      closeOnBackdrop={canCloseOnBackdrop}
      noBackdrop={config.noBackdrop}
    >
      <ModalComponent data={modalData} onClose={closeModal} />
    </DialogBase>
  );
};

export default ModalProvider;

'use client';

// ===== Types =====
export type { ModalType, ModalData, ModalConfig, ModalComponentProps } from './types';

export { MODAL_TYPES } from './types';

// ===== Components =====
export { default as ModalProvider } from './ModalProvider';
export { default as ModalContent } from './ModalContent';

// ===== Registry =====
export { registerModal, getModal, hasModal } from './registry';

// ===== 모달 등록 초기화 =====
import { registerModal } from './registry';
import ImageUploadModal from './components/ImageUploadModal';
import AiGuideModal from './components/AiGuideModal';
import ProjectSetupModal from './components/ProjectSetupModal';
import EditWarningModal from './components/EditWarningModal';
import AiDetailPageModal from './components/AiDetailPageModal';
import ProductInfoModal from './components/ProductInfoModal';
// 모달 레지스트리 초기화
// 기본값: closeOnBackdrop = false (대부분의 모달은 실수로 닫히면 안 됨)
// 닫혀도 되는 모달만 closeOnBackdrop: true 설정
registerModal('imageUpload', ImageUploadModal);
registerModal('aiGuide', AiGuideModal, {
  noBackdrop: true, // 자체 SpotlightBackdrop 사용
  closeOnBackdrop: true, // 정보성 가이드 - 외부 클릭 시 닫혀도 됨
});
registerModal('projectSetup', ProjectSetupModal);
registerModal('editWarning', EditWarningModal);
registerModal('aiDetailPage', AiDetailPageModal);
registerModal('productInfo', ProductInfoModal);

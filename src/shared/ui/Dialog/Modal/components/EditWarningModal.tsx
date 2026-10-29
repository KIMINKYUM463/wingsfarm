'use client';

import { useState } from 'react';
import { useDialog } from '../../useDialog';
import ModalContent from '../ModalContent';
import type { ModalComponentProps } from '../types';
import Button from '@/shared/ui/Button/Button';
import LabeledCheckbox from '@/shared/ui/LabeledCheckbox';

const STORAGE_KEY = 'hideEditWarning';

/**
 * EditWarningModal - 편집 내용 미반영 경고 모달
 *
 * AI 상세페이지 생성 전 기본 템플릿 편집이 반영되지 않음을 안내합니다.
 * "다시 보지 않음" 체크 시 localStorage에 저장하여 다음부터 스킵합니다.
 */
const EditWarningModal = ({ onClose }: ModalComponentProps) => {
  const [doNotShowAgain, setDoNotShowAgain] = useState(false);
  const { openModal } = useDialog();

  const handleConfirm = () => {
    if (doNotShowAgain) {
      localStorage.setItem(STORAGE_KEY, 'true');
    }
    onClose();
    openModal('aiDetailPage');
  };

  return (
    <ModalContent onClose={onClose} className="bg-white p-6 rounded-lg text-center" maxW="sm">
      <h3 className="h3-bold mb-4">편집 내용이 반영되지 않아요</h3>

      <p className="p text-gray-400 whitespace-pre-line">
        {'기본 템플릿의 요소를 바꾸면\nAI 상세페이지에는 해당 편집이 반영되지 않아요.'}
      </p>

      <div className="flex justify-center mt-4">
        <LabeledCheckbox
          id="do-not-show-again"
          text="다시 보지 않음"
          labelClassName="!gap-1"
          textClassName="description text-gray-400"
          checked={doNotShowAgain}
          onChange={(e) => setDoNotShowAgain(e.target.checked)}
        />
      </div>

      <Button className="w-full btn-primary mt-6" onClick={handleConfirm}>
        <span className="p-bold">확인했어요.</span>
      </Button>
    </ModalContent>
  );
};

export default EditWarningModal;

/**
 * 경고 모달 표시 여부 확인
 * localStorage에 저장된 값을 확인하여 스킵 여부 반환
 */
export function shouldShowEditWarning(): boolean {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem(STORAGE_KEY) !== 'true';
}

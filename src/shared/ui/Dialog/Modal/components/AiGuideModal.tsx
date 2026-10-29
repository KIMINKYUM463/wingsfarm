'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Button from '@/shared/ui/Button/Button';
import LabeledCheckbox from '@/shared/ui/LabeledCheckbox';
import ModalContent from '../ModalContent';
import { ILLUSTRATIONS } from '@/shared/constants/assets';
import { useDialog } from '@/shared/ui/Dialog/useDialog';
import { AI_GUIDE_STORAGE_KEY } from '@/features/editor/hooks/useAiGuideModal';
import type { ModalComponentProps } from '../types';

/** 스포트라이트 배경 - AI 버튼 영역만 밝게 표시 */
const SpotlightBackdrop = () => {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    const update = () => {
      const el = document.querySelector('#ai-button');
      if (el) setRect(el.getBoundingClientRect());
    };

    // 호버 transition(200ms) 완료 후 측정
    const timerId = setTimeout(update, 250);
    window.addEventListener('resize', update);
    return () => {
      clearTimeout(timerId);
      window.removeEventListener('resize', update);
    };
  }, []);

  if (!rect) return null;

  const padding = 8;

  return (
    <div
      className="pointer-events-none fixed -z-10"
      aria-hidden="true"
      style={{
        top: rect.top - padding,
        left: rect.left - padding,
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
        borderRadius: 8,
        boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.6)',
      }}
    />
  );
};

/** AiGuideModal - AI 가이드 안내 모달 */
const AiGuideModal = ({ onClose }: ModalComponentProps) => {
  const [doNotShowAgain, setDoNotShowAgain] = useState(false);
  const { openModal } = useDialog();

  /** 모든 닫기 동작 공통 처리 */
  const handleClose = () => {
    if (doNotShowAgain) {
      localStorage.setItem(AI_GUIDE_STORAGE_KEY, 'true');
    }
    onClose();
  };

  const handleStart = () => {
    handleClose();
    openModal('aiDetailPage');
  };

  return (
    <>
      <SpotlightBackdrop />
      <ModalContent
        onClose={handleClose}
        className="rounded-lg bg-white p-8 shadow-[0px_4px_16px_0px_rgba(117,117,117,0.18)]"
      >
        <div className="flex flex-col items-center gap-6">
          <div className="flex w-full flex-col gap-1">
            <p className="title-1-bold text-(--color-point)">AI로 상세페이지 완성하기</p>
            <h2 className="h2-bold">
              상품의 핵심 정보만 입력하면,
              <br />
              AI가 자동으로 채워드려요.
            </h2>
          </div>
          <div className="flex flex-col items-center gap-4">
            <Image src={ILLUSTRATIONS.Guide} alt="AI guide" width={113} height={127} />
            <LabeledCheckbox
              id="do-not-show-again"
              text="다시 보지 않음"
              labelClassName="!gap-1"
              textClassName="description text-gray-400"
              checked={doNotShowAgain}
              onChange={(e) => setDoNotShowAgain(e.target.checked)}
            />
          </div>
          <div className="flex w-full gap-4">
            <Button
              onClick={handleClose}
              className="h-(--btn-h) flex-1 rounded-lg bg-gray-50 px-4 text-gray-400 hover:bg-gray-100 active:bg-gray-200"
            >
              <span className="p">나중에 하기</span>
            </Button>
            <Button
              onClick={handleStart}
              className="btn-primary flex-1"
            >
              <span className="p">시작하기</span>
            </Button>
          </div>
        </div>
      </ModalContent>
    </>
  );
};

export default AiGuideModal;

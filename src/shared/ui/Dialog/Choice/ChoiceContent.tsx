'use client';

import { MouseEvent } from 'react';
import Button from '@/shared/ui/Button/Button';
import CloseButton from '../shared/CloseButton';
import type { ChoiceOptions } from './types';

interface ChoiceContentProps {
  options: ChoiceOptions;
  onClose: () => void;
}

/**
 * ChoiceContent - 선택 다이얼로그 컨텐츠
 * Confirm과 동일한 UI, 두 선택지 + X 닫기 버튼
 */
const ChoiceContent = ({ options, onClose }: ChoiceContentProps) => {
  const handleContentClick = (e: MouseEvent) => {
    e.stopPropagation();
  };

  const [first, second] = options.choices;

  return (
    <div
      className="relative z-10 w-full max-w-(--max-w-confirm) rounded-lg bg-white p-6 text-center"
      onClick={handleContentClick}
    >
      {/* X 닫기 버튼 */}
      <CloseButton onClick={onClose} />

      {/* 제목 */}
      <h3 id="choice-dialog-title" className="h3-bold">
        {options.title}
      </h3>

      {/* 설명 */}
      {options.description && (
        <p id="choice-dialog-description" className="mt-4 whitespace-pre-line text-gray-400">
          {options.description}
        </p>
      )}

      {/* 선택지 버튼: primary는 오른쪽(order-2), secondary는 왼쪽(order-1) */}
      <form method="dialog" className="mt-6 flex w-full gap-4">
        <Button
          type="submit"
          value={first.value}
          className={`flex-1 ${first.variant === 'primary' ? 'btn-primary order-2' : 'btn-cancel order-1'}`}
        >
          <span className="title-1-bold p">{first.label}</span>
        </Button>
        <Button
          type="submit"
          value={second.value}
          className={`flex-1 ${second.variant === 'primary' ? 'btn-primary order-2' : 'btn-cancel order-1'}`}
        >
          <span className="title-1-bold p">{second.label}</span>
        </Button>
      </form>
    </div>
  );
};

export default ChoiceContent;

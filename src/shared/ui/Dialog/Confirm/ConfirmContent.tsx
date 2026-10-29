'use client';

import { MouseEvent } from 'react';
import Button from '@/shared/ui/Button/Button';
import CustomIcon from '@/shared/ui/CustomIcon';
import CloseButton from '../shared/CloseButton';
import type { ConfirmOptions } from './types';

interface ConfirmContentProps {
  options: ConfirmOptions;
  onClose: () => void;
}

/**
 * ConfirmContent - 확인 다이얼로그 컨텐츠
 * form method="dialog" 패턴으로 네이티브 dialog API 활용
 */
const ConfirmContent = ({ options, onClose }: ConfirmContentProps) => {
  const handleContentClick = (e: MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      className="relative z-10 w-full max-w-(--max-w-confirm) rounded-lg bg-white p-6 text-center"
      onClick={handleContentClick}
    >
      {/* X 닫기 버튼 */}
      <CloseButton onClick={onClose} />

      {/* 아이콘 (선택) */}
      {options.icon && (
        <div className="mb-3 flex justify-center">
          <CustomIcon
            name={options.icon.name}
            width={options.icon.width ?? 48}
            height={options.icon.height ?? 48}
          />
        </div>
      )}

      {/* 제목 */}
      <h3 id="confirm-dialog-title" className="h3-bold">
        {options.title}
      </h3>

      {/* 설명 */}
      {options.description && (
        <p id="confirm-dialog-description" className="mt-2 whitespace-pre-line text-gray-400">
          {options.description}
        </p>
      )}

      {/* 추가 안내 문구 */}
      {options.hint && (
        <p className="mt-2 description whitespace-pre-line text-gray-300">{options.hint}</p>
      )}

      {/* 버튼 영역: DOM 순서는 확인 먼저 (Enter 키 대응), 시각적 순서는 order로 조정 */}
      <form method="dialog" className="mt-6 flex w-full gap-4">
        <Button
          type="submit"
          value="confirm"
          className="btn-primary order-2 flex-1"
          isLoading={options.isPending}
          onClick={options.onConfirmClick}
        >
          <span className="title-1-bold p">{options.confirmText || '확인'}</span>
        </Button>
        <Button
          type="submit"
          value="cancel"
          className="btn-cancel order-1 flex-1"
          disabled={options.isPending}
        >
          <span className="title-1-bold p">{options.cancelText || '취소'}</span>
        </Button>
      </form>
    </div>
  );
};

export default ConfirmContent;

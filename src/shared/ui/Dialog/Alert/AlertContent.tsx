'use client';

import { MouseEvent } from 'react';
import Button from '@/shared/ui/Button/Button';
import CloseButton from '../shared/CloseButton';
import type { AlertOptions } from './types';

interface AlertContentProps {
  options: AlertOptions;
  onClose: () => void;
}

/**
 * AlertContent - Alert 다이얼로그 컨텐츠
 * form method="dialog" 패턴으로 네이티브 dialog API 활용
 */
const AlertContent = ({ options, onClose }: AlertContentProps) => {
  // 이벤트 버블링 방지 (배경 클릭과 분리)
  const handleContentClick = (e: MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      className="relative z-10 bg-white text-center p-6 rounded-lg w-full max-w-(--max-w-confirm)"
      onClick={handleContentClick}
    >
      {/* 닫기 버튼 */}
      <CloseButton onClick={onClose} />

      {/* 아이콘 */}
      {options.icon && (
        <div className="mb-4 flex justify-center">{options.icon}</div>
      )}

      {/* 제목 */}
      <h3 id="alert-dialog-title" className="h3-bold mb-4">
        {options.title}
      </h3>

      {/* 설명 */}
      {options.description && (
        <p id="alert-dialog-description" className="p text-gray-400 whitespace-pre-line">
          {options.description}
        </p>
      )}

      {/* 확인 버튼 - form method="dialog"로 네이티브 닫기 */}
      <form method="dialog" className="mt-6">
        <Button type="submit" value="confirm" className="w-full btn-primary">
          <span className="p-bold">{options.confirmText || '확인'}</span>
        </Button>
      </form>
    </div>
  );
};

export default AlertContent;

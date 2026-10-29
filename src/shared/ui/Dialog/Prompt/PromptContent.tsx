'use client';

import { MouseEvent, useState } from 'react';
import Button from '@/shared/ui/Button/Button';
import Input from '@/shared/ui/Input/Input';
import type { PromptOptions } from './types';

interface PromptContentProps {
  options: PromptOptions;
  /** form submit 시 input 값 캡처 */
  onInputCapture: (value: string) => void;
}

/**
 * PromptContent - Prompt 다이얼로그 컨텐츠
 * form method="dialog" 패턴으로 네이티브 dialog API 활용
 */
const PromptContent = ({ options, onInputCapture }: PromptContentProps) => {
  const [inputValue, setInputValue] = useState(options.defaultValue || '');

  // 이벤트 버블링 방지 (배경 클릭과 분리)
  const handleContentClick = (e: MouseEvent) => {
    e.stopPropagation();
  };

  // form submit 시 input 값 캡처
  const handleSubmit = () => {
    onInputCapture(inputValue);
  };

  return (
    <div
      className="relative z-10 bg-white text-center p-6 space-y-6 rounded-lg w-full max-w-(--max-w-confirm)"
      onClick={handleContentClick}
    >
      {/* 제목 */}
      <h3 id="prompt-dialog-title" className="h3-bold">
        {options.title}
      </h3>

      {/* 설명 */}
      {options.description && (
        <p id="prompt-dialog-description" className="text-gray-400 whitespace-pre-line">
          {options.description}
        </p>
      )}

      {/* 입력 필드 + 버튼 - form method="dialog"로 네이티브 닫기 */}
      <form method="dialog" className="space-y-4" onSubmit={handleSubmit}>
        <Input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={options.placeholder}
          autoFocus
          className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-(--color-point) focus:outline-none"
        />
        {/* 확인 버튼을 DOM에서 먼저 배치 (Enter 키 시 트리거), order로 시각적 순서 조정 */}
        <div className="flex gap-3 w-full">
          <Button type="submit" value="confirm" className="flex-1 btn-primary order-2">
            <span className="title-1-bold p">{options.confirmText || '확인'}</span>
          </Button>
          <Button type="submit" value="cancel" className="flex-1 btn-cancel order-1">
            <span className="title-1-bold p">{options.cancelText || '취소'}</span>
          </Button>
        </div>
      </form>
    </div>
  );
};

export default PromptContent;

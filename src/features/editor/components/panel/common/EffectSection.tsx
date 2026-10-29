'use client';

import React, { useState } from 'react';
import clsx from 'clsx';
import LabeledCheckbox from '@/shared/ui/LabeledCheckbox';
import Button from '@/shared/ui/Button/Button';
import Icon from '@/shared/ui/Icon';

interface EffectSectionProps {
  /** 섹션 제목 */
  title: string;
  /** 효과 활성화 여부 (체크박스 상태) */
  isEnabled: boolean;
  /** 체크박스 변경 핸들러 */
  onToggle: (enabled: boolean) => void;
  /** 섹션 내용 */
  children: React.ReactNode;
  /** 초기 펼침 상태 (기본: true) */
  defaultOpen?: boolean;
}

/**
 * 효과 섹션 컴포넌트 (체크박스 + 여닫기)
 * - ToolFormLayout과 동일한 디자인 패턴
 * - 체크박스: 효과 활성화/비활성화 토글
 * - 여닫기: 내용 펼침/접힘 (체크박스와 독립)
 */
const EffectSection: React.FC<EffectSectionProps> = ({
  title,
  isEnabled,
  onToggle,
  children,
  defaultOpen = true,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    onToggle(checked);
    // 체크 시 열기, 해제 시 접기
    setIsOpen(checked);
  };

  return (
    <div className="space-y-4">
      {/* Header: ToolFormLayout과 동일한 flex justify-between 구조 */}
      <div className="flex items-center justify-between">
        <LabeledCheckbox
          labelClassName="p-reg"
          text={title}
          checked={isEnabled}
          onChange={handleCheckboxChange}
          size={4}
        />
        <Button
          onClick={() => setIsOpen((prev) => !prev)}
          className="btn-icon"
          aria-expanded={isOpen}
          aria-label={isOpen ? '접기' : '펼치기'}
        >
          <Icon
            name="keyboard_arrow_up"
            width={24}
            height={24}
            className={clsx('transition-transform', !isOpen && 'rotate-180')}
          />
        </Button>
      </div>

      {/* Content: 펼쳐진 내용 */}
      {isOpen && children}
    </div>
  );
};

export default EffectSection;

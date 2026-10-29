'use client';

import React from 'react';
import clsx from 'clsx';
import Button from '@/shared/ui/Button/Button';
import CustomIcon from '@/shared/ui/CustomIcon';
import { AI_IMAGE_CREDIT_COST } from '@/features/payments';

interface ToolFixedButtonSectionProps {
  /**
   * 크레딧 소모 정보 표시 여부 (true면 "20 크레딧 소모" 표시)
   */
  showCreditInfo?: boolean;
  /**
   * 설명 텍스트 (일반 설명용, showCreditInfo와 함께 사용 불가)
   */
  descriptionText?: string;
  /**
   * 설명 영역 스타일 (색상 등)
   */
  descriptionClassName?: string;
  /**
   * 버튼 텍스트
   * @default '생성하기'
   */
  buttonText?: string;
  /**
   * 연결할 form의 id (form attribute로 외부 form과 연결)
   */
  formId?: string;
  /**
   * 버튼 클릭 핸들러 (formId 없을 때 사용)
   */
  onButtonClick?: () => void;
  /**
   * 버튼 비활성화 여부
   */
  disabled?: boolean;
  /**
   * 로딩 상태
   */
  isLoading?: boolean;
  /**
   * 추가 클래스명
   */
  className?: string;
  /**
   * 버튼 스타일 클래스명
   * @default 'btn-primary'
   */
  buttonClassName?: string;
  /**
   * 보조 버튼 텍스트 (있으면 2버튼 레이아웃)
   */
  secondaryButtonText?: string;
  /**
   * 보조 버튼 클릭 핸들러
   */
  onSecondaryButtonClick?: () => void;
  /**
   * 보조 버튼 스타일 클래스명
   * @default 'btn-ghost'
   */
  secondaryButtonClassName?: string;
}

/**
 * 툴 하단에 고정되는 버튼 섹션 컴포넌트
 *
 * @example
 * ```tsx
 * // 크레딧 소모 정보 표시
 * <ToolFixedButtonSection
 *   showCreditInfo
 *   buttonText="생성하기"
 *   formId={formId}
 * />
 *
 * // 일반 텍스트
 * <ToolFixedButtonSection
 *   descriptionText="취소 시 사용한 크레딧은 복구되지 않습니다."
 *   descriptionClassName="text-(--color-gray-300)"
 *   buttonText="취소"
 * />
 *
 * // 버튼만
 * <ToolFixedButtonSection buttonText="저장" />
 *
 * // 2버튼 레이아웃
 * <ToolFixedButtonSection
 *   showCreditInfo
 *   secondaryButtonText="돌아가기"
 *   onSecondaryButtonClick={handleBack}
 *   buttonText="다시 생성하기"
 *   onButtonClick={handleRegenerate}
 * />
 * ```
 */
const ToolFixedButtonSection: React.FC<ToolFixedButtonSectionProps> = ({
  showCreditInfo = false,
  descriptionText,
  descriptionClassName,
  buttonText = '생성하기',
  formId,
  onButtonClick,
  disabled = false,
  isLoading = false,
  className,
  buttonClassName = 'btn-primary',
  secondaryButtonText,
  onSecondaryButtonClick,
  secondaryButtonClassName = 'btn-ghost',
}) => {
  const hasTwoButtons = !!secondaryButtonText;

  return (
    <div className={clsx('z-50 space-y-3 bg-white px-6 pt-3 pb-6', className)}>
      {/* TODO: 크레딧 소모 정보 임시 숨김 */}
      {/* {showCreditInfo && (
        <div className="flex items-center justify-center gap-1 text-(--color-credit-text)">
          <CustomIcon name="credit" width={12} height={12} />
          <span className="description">{AI_IMAGE_CREDIT_COST} 크레딧 소모</span>
        </div>
      )} */}

      {/* 일반 설명 텍스트 */}
      {!showCreditInfo && descriptionText && (
        <div className={clsx('flex items-center justify-center gap-1', descriptionClassName)}>
          <span className="description">{descriptionText}</span>
        </div>
      )}

      {/* 버튼 영역 */}
      <div className={clsx(hasTwoButtons && 'flex gap-2')}>
        {/* 보조 버튼 (있을 때만) */}
        {hasTwoButtons && (
          <Button
            type="button"
            className={clsx('flex-1', secondaryButtonClassName)}
            onClick={onSecondaryButtonClick}
          >
            <span className="p">{secondaryButtonText}</span>
          </Button>
        )}

        {/* 메인 버튼 */}
        <Button
          type={formId ? 'submit' : 'button'}
          form={formId}
          className={clsx(hasTwoButtons ? 'flex-1' : 'w-full', buttonClassName)}
          onClick={formId ? undefined : onButtonClick}
          isLoading={isLoading}
          disabled={disabled}
        >
          <span className="p">{buttonText}</span>
        </Button>
      </div>
    </div>
  );
};

export default ToolFixedButtonSection;

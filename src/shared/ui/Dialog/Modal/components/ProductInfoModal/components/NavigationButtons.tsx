import Button from '@/shared/ui/Button/Button';

interface NavigationButtonsProps {
  currentStep: number;
  totalSteps: number;
  onPrevious: () => void;
  onNext: () => void;
  isLoading: boolean;
  /** 다음 버튼 비활성화 (유효성 검증 실패 시) */
  nextDisabled?: boolean;
  /** 이전 버튼 비활성화 (업로드 진행 중 등) */
  prevDisabled?: boolean;
}

const NavigationButtons = ({
  currentStep,
  totalSteps,
  onPrevious,
  onNext,
  isLoading,
  nextDisabled = false,
  prevDisabled = false,
}: NavigationButtonsProps) => {
  return (
    <div className="flex justify-end items-center gap-3 mt-auto pt-12">
      {/* 이전 버튼 - 로딩 중 또는 업로드 진행 중 비활성화 */}
      <Button type="button" onClick={onPrevious} className="btn-cancel" disabled={isLoading || prevDisabled}>
        <span className="p text-gray-500">이전</span>
      </Button>

      {/* 다음/완료 버튼 - 유효성 검증 실패 또는 로딩 중 비활성화 */}
      <Button
        type="button"
        onClick={onNext}
        className="btn-primary"
        isLoading={isLoading}
        disabled={nextDisabled || isLoading}
      >
        <span className="p-bold">{currentStep === totalSteps ? '완료' : '다음'}</span>
      </Button>
    </div>
  );
};

export default NavigationButtons;

'use client';

import { Activity, useState } from 'react';
import { useWatch } from 'react-hook-form';
import ModalContent from '../../ModalContent';
import ScrollArea from '@/shared/ui/ScrollArea';
import { useProductInfoModal } from './useProductInfoModal';
import StepIndicator from './components/StepIndicator';
import NavigationButtons from './components/NavigationButtons';
import Step1CompanyName from './steps/Step1CompanyName';
import Step2GenerationMethod from './steps/Step2GenerationMethod';
import Step3KeywordSelection from './steps/Step3KeywordSelection';
import Step4ProductImages from './steps/Step4ProductImages';
import type { ProductInfoStep } from './types';
import type { ModalComponentProps } from '../../types';
import CustomIcon from '@/shared/ui/CustomIcon';
import { useDialog } from '@/shared/ui/Dialog/useDialog';

const TOTAL_STEPS = 4;

const ProductInfoModal = ({ data }: ModalComponentProps) => {
  const [currentStep, setCurrentStep] = useState<ProductInfoStep>(1);
  const { openModal, closeModal } = useDialog();

  // 모달 데이터에서 projectId 추출 (AiDetailPageModal에서 전달)
  const projectId = (data?.projectId as string) || '';

  const {
    form,
    isPending,
    isUploadingProduct,
    isUploadingReference,
    productImagePreviews,
    referenceImagePreviews,
    canProceed,
    canGoToNextStep,
    createUrlUpdateHandler,
    handleRemoveImage,
    handleFinalSubmit,
    resetReferenceImagePreviews,
  } = useProductInfoModal({ currentStep, projectId });

  // Activity hidden 상태에서 useWatch가 업데이트되지 않는 문제 해결
  const generationMethod = useWatch({
    control: form.control,
    name: 'generationMethod',
  }) as 'keyword_selection' | 'image_upload';

  const handleNext = async () => {
    const isValid = await canGoToNextStep(currentStep);
    if (!isValid) return;

    if (currentStep === TOTAL_STEPS) {
      handleFinalSubmit();
      return;
    }
    setCurrentStep((currentStep + 1) as ProductInfoStep);
  };

  const handlePrevious = () => {
    if (currentStep === 1) {
      openModal('aiDetailPage');
      return;
    }
    setCurrentStep((currentStep - 1) as ProductInfoStep);
  };

  const getStepTitle = (step: ProductInfoStep): string => {
    if (step === 1) return '업체명(브랜드명)을 알려주세요.';
    if (step === 2) return '어떤 방식으로 상세페이지를 만들고 싶으신가요?';
    if (step === 3) return '상세 정보를 입력해주세요.';
    if (step === 4) return '상품 이미지를 업로드해주세요.';
    return '';
  };

  return (
    <ModalContent
      onClose={closeModal}
      className="bg-white rounded-xl max-h-160 py-9 px-0"
      maxW="lg"
    >
      {/* 스크롤 영역: 스크롤바가 모달 오른쪽 끝에, py 안쪽 영역에만 표시 */}
      <ScrollArea className="h-full max-h-142">
        <div className="flex flex-col min-h-full px-9">
          {/* Header */}
          <StepIndicator currentStep={currentStep} totalSteps={TOTAL_STEPS} />
          <div className="flex flex-col gap-3 py-9">
            <div className="flex items-center gap-1.75">
              <CustomIcon name="ai-star-24" width={24} height={24} className="text-(--color-point)" />
              <span className="h3-bold text-(--color-point)">AI로 상세페이지 완성하기</span>
            </div>
            <h2 className="h2-bold">{getStepTitle(currentStep)}</h2>
          </div>

          {/* Step Content - Activity로 상태 보존 */}
          <div className="flex-1">
            <Activity mode={currentStep === 1 ? 'visible' : 'hidden'}>
              <Step1CompanyName form={form} />
            </Activity>
            <Activity mode={currentStep === 2 ? 'visible' : 'hidden'}>
              <Step2GenerationMethod form={form} onMethodChange={resetReferenceImagePreviews} />
            </Activity>
            <Activity mode={currentStep === 3 ? 'visible' : 'hidden'}>
              <Step3KeywordSelection
                form={form}
                projectId={projectId}
                generationMethod={generationMethod}
                referenceImagePreviews={referenceImagePreviews}
                isUploadingReference={isUploadingReference}
                createUrlUpdateHandler={createUrlUpdateHandler}
                handleRemoveImage={handleRemoveImage}
              />
            </Activity>
            <Activity mode={currentStep === 4 ? 'visible' : 'hidden'}>
              <Step4ProductImages
                form={form}
                productImagePreviews={productImagePreviews}
                isUploadingProduct={isUploadingProduct}
                createUrlUpdateHandler={createUrlUpdateHandler}
                handleRemoveImage={handleRemoveImage}
              />
            </Activity>
          </div>

          {/* Navigation */}
          <NavigationButtons
            currentStep={currentStep}
            totalSteps={TOTAL_STEPS}
            onPrevious={handlePrevious}
            onNext={handleNext}
            isLoading={isPending}
            nextDisabled={!canProceed || isUploadingProduct || isUploadingReference}
            prevDisabled={isUploadingProduct || isUploadingReference}
          />
        </div>
      </ScrollArea>
    </ModalContent>
  );
};

export default ProductInfoModal;

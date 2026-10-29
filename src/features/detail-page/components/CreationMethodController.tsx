'use client';

import React, { useCallback } from 'react'; // useCallback 임포트
import { Controller, Control, UseFormSetValue } from 'react-hook-form';
import PageCreationMethodSelector from './PageCreationMethodSelector';
import { CreateDetailPageRequest } from '@/shared/types/detail-page';

interface CreationMethodControllerProps {
  control: Control<CreateDetailPageRequest>;
  setValue: UseFormSetValue<CreateDetailPageRequest>;
  /** 방식 변경 시 참조 이미지 프리뷰 초기화 콜백 */
  onMethodChange?: () => void;
}

// 상세페이지 생성 방식(키워드/이미지)을 선택하고 폼 상태를 초기화하는 Controller 컴포넌트
const CreationMethodController: React.FC<CreationMethodControllerProps> = ({
  control,
  setValue,
  onMethodChange,
}) => {
  const handleMethodChange = useCallback(
    (method: 'keyword' | 'image') => {
      // 방식 변경 시 참조 이미지 프리뷰 초기화
      onMethodChange?.();

      if (method === 'keyword') {
        setValue('generationData', {
          keywordSelection: {
            keywordData: undefined,
            customFeatures: '',
          },
        } as never);
        return 'keyword_selection';
      }

      if (method === 'image') {
        setValue('generationData', {
          imageUpload: {
            detailPageUrls: [],
          },
        } as never);
        return 'image_upload';
      }

      return method;
    },
    [setValue, onMethodChange],
  );

  return (
    <Controller
      name="generationMethod"
      control={control}
      render={({ field }) => (
        <PageCreationMethodSelector
          selectedMethod={field.value === 'keyword_selection' ? 'keyword' : 'image'}
          onMethodChange={(method) => {
            const generationMethodValue = handleMethodChange(method);
            field.onChange(generationMethodValue); // 👈 훅에서 반환된 값으로 필드 업데이트
          }}
        />
      )}
    />
  );
};

export default CreationMethodController;

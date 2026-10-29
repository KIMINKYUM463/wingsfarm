import type { UseFormReturn } from 'react-hook-form';
import type { CreateDetailPageRequest } from '@/shared/types/detail-page';
import type { UploadedImageInfo } from '@/features/detail-page/hooks/useImageUpload';

export type ProductInfoStep = 1 | 2 | 3 | 4;

export interface StepComponentProps {
  form: UseFormReturn<CreateDetailPageRequest>;
}

export interface Step2Props extends StepComponentProps {
  /** 방식 변경 시 참조 이미지 프리뷰 초기화 */
  onMethodChange?: () => void;
}

export interface Step3Props extends StepComponentProps {
  projectId: string;
  /** Activity hidden 상태에서 useWatch가 업데이트되지 않는 문제 해결용 */
  generationMethod: 'keyword_selection' | 'image_upload';
  referenceImagePreviews: UploadedImageInfo[];
  isUploadingReference: boolean;
  createUrlUpdateHandler: (
    fieldPath: string,
  ) => (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleRemoveImage: (fieldPath: string) => (fileKey: string) => void;
}

export interface Step4Props extends StepComponentProps {
  productImagePreviews: UploadedImageInfo[];
  isUploadingProduct: boolean;
  createUrlUpdateHandler: (
    fieldPath: string,
  ) => (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleRemoveImage: (fieldPath: string) => (fileKey: string) => void;
}

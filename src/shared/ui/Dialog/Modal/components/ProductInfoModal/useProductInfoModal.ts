import { useCallback, useState, useMemo, useEffect, useRef } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { productInfoFormSchema } from '@/validation/productInfoForm.schema';
import { generateProject } from '@/app/actions/detail-page';
import { useImageUpload, UploadedImageInfo } from '@/features/detail-page/hooks/useImageUpload';
import { CreateDetailPageRequest } from '@/shared/types/detail-page';
import { ROUTES } from '@/shared/constants/routes';
import { useDialog } from '@/shared/ui/Dialog/useDialog';
import type { ProductInfoStep } from './types';

interface UseProductInfoModalParams {
  currentStep: ProductInfoStep;
  projectId: string;
}

export const useProductInfoModal = ({ currentStep, projectId }: UseProductInfoModalParams) => {
  const router = useRouter();
  const { openConfirm } = useDialog();

  // 이미지 프리뷰 상태
  const [productImagePreviews, setProductImagePreviews] = useState<UploadedImageInfo[]>([]);
  const [referenceImagePreviews, setReferenceImagePreviews] = useState<UploadedImageInfo[]>([]);

  // 언마운트 시 cleanup을 위한 ref (최신 상태 참조)
  const productImagePreviewsRef = useRef(productImagePreviews);
  const referenceImagePreviewsRef = useRef(referenceImagePreviews);
  productImagePreviewsRef.current = productImagePreviews;
  referenceImagePreviewsRef.current = referenceImagePreviews;

  // React Hook Form 설정
  const form = useForm<CreateDetailPageRequest>({
    resolver: zodResolver(productInfoFormSchema),
    mode: 'onChange',
    shouldFocusError: false,
    defaultValues: {
      companyName: '',
      generationMethod: 'keyword_selection',
      productImageUrls: [],
      generationData: {
        keywordSelection: {
          keywordData: undefined,
          customFeatures: '',
        },
      },
    },
  });

  const {
    trigger,
    getValues,
    setValue,
    control,
    formState: { errors },
  } = form;

  // 실시간 폼 값 감시 (canProceed용)
  const companyName = useWatch({ control, name: 'companyName' });
  const generationMethod = useWatch({ control, name: 'generationMethod' });
  const generationData = useWatch({ control, name: 'generationData' }) as
    | {
        keywordSelection?: {
          keywordData?: { groups: { name: string; keywords: string[] }[] };
          customFeatures?: string;
        };
        imageUpload?: { detailPageUrls: string[] };
      }
    | undefined;
  const productImageUrls = useWatch({ control, name: 'productImageUrls' }) as string[] | undefined;

  // 스텝별 버튼 활성화 여부 (값 체크 + validation 에러 체크)
  const canProceed = useMemo(() => {
    // Step 1: 업체명 (1글자 이상 && validation 통과)
    if (currentStep === 1) return !!companyName?.trim() && !errors.companyName;

    // Step 2: 생성 방식 (기본값 있음)
    if (currentStep === 2) return true;

    // Step 3: 키워드 선택 또는 이미지 업로드
    if (currentStep === 3) {
      // 키워드 선택 방식
      if (generationMethod === 'keyword_selection') {
        const keywordSelection = generationData?.keywordSelection;
        const hasKeywords =
          keywordSelection?.keywordData?.groups?.some((g) => g.keywords.length > 0) ?? false;
        const hasCustomFeatures = !!keywordSelection?.customFeatures?.trim();
        return hasKeywords || hasCustomFeatures;
      }
      // 이미지 업로드 방식
      const imageUpload = generationData?.imageUpload;
      return (imageUpload?.detailPageUrls?.length ?? 0) > 0;
    }

    // Step 4: 상품 이미지 (선택 · 최대 10개)
    if (currentStep === 4) return !errors.productImageUrls;

    return false;
  }, [currentStep, companyName, generationMethod, generationData, productImageUrls, errors]);

  // 이미지 업로드 mutations
  const { mutate: uploadProductImages, isPending: isUploadingProduct } = useImageUpload('product');
  const { mutate: uploadReferenceImages, isPending: isUploadingReference } =
    useImageUpload('reference');

  // 최종 제출 mutation
  const { mutate: submitForm, isPending } = useMutation({
    mutationFn: async (data: CreateDetailPageRequest) => {
      // 에러 시 throw → MutationCache.onError에서 전역 처리
      const response = await generateProject(projectId, data);
      // response는 CreateDetailPageResponse, response.data는 실제 job 데이터 { id, status, message }
      return response.data;
    },
    onSuccess: (jobData) => {
      // 모달은 GeneratingContent에서 마운트 시 자동 닫힘
      // sourceProjectId 전달하여 새 프로젝트 생성 시 기존 프로젝트로 복귀 가능하게 함
      router.replace(ROUTES.PROJECT_GENERATING(jobData.id, { source: projectId }));
    },
  });

  // 스텝별 검증 함수 (다음 버튼 클릭 시 최종 검증)
  const canGoToNextStep = useCallback(
    async (step: ProductInfoStep): Promise<boolean> => {
      // Step 1: 업체명 검증
      if (step === 1) return await trigger(['companyName']);

      // Step 2: 생성 방식 (기본값 있음)
      if (step === 2) return true;

      // Step 3: 키워드 선택 또는 이미지 업로드 검증
      if (step === 3) {
        const method = getValues('generationMethod');
        // 키워드 선택 방식 검증
        if (method === 'keyword_selection') {
          return await trigger(['generationData.keywordSelection']);
        }
        // 이미지 업로드 방식 검증
        return await trigger(['generationData.imageUpload.detailPageUrls']);
      }

      // Step 4: 상품 이미지 검증
      if (step === 4) return await trigger(['productImageUrls']);

      return false;
    },
    [trigger, getValues],
  );

  // 이미지 URL 업데이트 핸들러 (discriminatedUnion 대응)
  const createUrlUpdateHandler = useCallback(
    (fieldPath: string) => async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files || files.length === 0) return;

      const imageFiles = Array.from(files).filter((file) => file.type.startsWith('image/'));
      if (imageFiles.length === 0) return;

      const isProductImage = fieldPath === 'productImageUrls';
      const uploadFn = isProductImage ? uploadProductImages : uploadReferenceImages;
      const setImagePreviews = isProductImage ? setProductImagePreviews : setReferenceImagePreviews;

      const updateFormValue = (newPaths: string[]) => {
        // productImageUrls는 최상위 필드이므로 직접 설정
        if (isProductImage) {
          const currentUrls = (getValues('productImageUrls') as string[]) || [];
          const updatedUrls = [...currentUrls, ...newPaths];
          setValue('productImageUrls', updatedUrls as never, { shouldValidate: true });
          return;
        }

        // generationData.imageUpload.detailPageUrls는 generationData 전체 재설정
        const currentUrls =
          (getValues('generationData.imageUpload.detailPageUrls') as string[]) || [];
        const updatedUrls = [...currentUrls, ...newPaths];
        setValue('generationData', { imageUpload: { detailPageUrls: updatedUrls } } as never, {
          shouldValidate: true,
        });
      };

      uploadFn(imageFiles, {
        onSuccess: (uploadedImages: UploadedImageInfo[]) => {
          setImagePreviews((prev) => [...prev, ...uploadedImages]);
          const newPaths = uploadedImages.map((img) => img.uploadedPath);
          updateFormValue(newPaths);
        },
      });

      event.target.value = '';
    },
    [getValues, setValue, uploadProductImages, uploadReferenceImages],
  );

  // 이미지 제거 핸들러 (discriminatedUnion 대응)
  const handleRemoveImage = useCallback(
    (fieldPath: string) => (fileKey: string) => {
      const isProductImage = fieldPath === 'productImageUrls';
      const imagePreviews = isProductImage ? productImagePreviews : referenceImagePreviews;
      const setImagePreviews = isProductImage ? setProductImagePreviews : setReferenceImagePreviews;

      const imageToRemove = imagePreviews.find((img) => img.fileKey === fileKey);
      if (!imageToRemove) return;

      // 프리뷰 상태 업데이트
      const updatedPreviews = imagePreviews.filter((img) => img.fileKey !== fileKey);
      setImagePreviews(updatedPreviews);

      // productImageUrls는 최상위 필드이므로 직접 설정
      if (isProductImage) {
        const currentUrls = (getValues('productImageUrls') as string[]) || [];
        const updatedUrls = currentUrls.filter((url) => url !== imageToRemove.uploadedPath);
        setValue('productImageUrls', updatedUrls as never, {
          shouldDirty: true,
          shouldValidate: true,
        });
        URL.revokeObjectURL(imageToRemove.previewUrl);
        return;
      }

      // generationData.imageUpload.detailPageUrls는 generationData 전체 재설정
      const currentUrls =
        (getValues('generationData.imageUpload.detailPageUrls') as string[]) || [];
      const updatedUrls = currentUrls.filter((url) => url !== imageToRemove.uploadedPath);
      setValue('generationData', { imageUpload: { detailPageUrls: updatedUrls } } as never, {
        shouldDirty: true,
        shouldValidate: true,
      });
      URL.revokeObjectURL(imageToRemove.previewUrl);
    },
    [getValues, setValue, productImagePreviews, referenceImagePreviews],
  );

  // 최종 제출 함수
  const handleFinalSubmit = useCallback(async () => {
    if (isPending) return;

    const isValid = await trigger();
    if (!isValid) return;

    const confirmed = await openConfirm({
      title: '상세페이지 생성',
      description: '상세페이지를 생성하시겠습니까?',
      confirmText: '생성하기',
      cancelText: '취소',
    });

    if (!confirmed) return;

    submitForm(getValues());
  }, [trigger, getValues, submitForm, isPending, openConfirm]);

  // 참조 이미지 프리뷰 초기화 (방식 변경 시 호출)
  const resetReferenceImagePreviews = useCallback(() => {
    // 메모리 누수 방지: 기존 blob URL 해제
    referenceImagePreviews.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    setReferenceImagePreviews([]);
  }, [referenceImagePreviews]);

  // 모달 언마운트 시 모든 blob URL 해제
  useEffect(() => {
    return () => {
      productImagePreviewsRef.current.forEach((img) => URL.revokeObjectURL(img.previewUrl));
      referenceImagePreviewsRef.current.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    };
  }, []);

  return {
    form,
    projectId,
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
  };
};

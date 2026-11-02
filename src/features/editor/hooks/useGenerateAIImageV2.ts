import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useShallow } from 'zustand/react/shallow';
import { generateAIImageV2 } from '@/features/detail-page/api';
import { useImageGenerationMajors } from '@/features/editor/context/ImageGenerationStylesContext';
import {
  usePushMoreView,
  useClearMoreView,
  ProductImageItem,
} from '@/features/editor/store/useToolPanelStore';
import { useImageGenerationStore } from '@/features/editor/store/useImageGenerationStore';
export type { CompletedImageInfo } from './useImageGenerationJobV2';
import { TOGGLE_STATES } from '@/shared/constants/ui/toggles';
import { CustomError } from '@/shared/lib/CustomError';
import { showToast } from '@/utils/toast';
import { confirmAiImages } from '@/shared/ui/Dialog';
import { mutationKeys } from '@/shared/constants/mutationKeys';
import { aiImageFormSchema, type AIImageFormData } from '@/validation/aiImageForm.schema';

/** 선택된 스타일 표시 정보 */
export interface SelectedStyleDisplay {
  majorName: string;
  styleName: string;
  thumbnailUrl: string;
}

/** 선택된 참조 이미지 표시 정보 */
export interface SelectedAssetDisplay {
  assetId: string;
  thumbnailUrl: string;
}

/** 스타일 룩업용 타입 */
interface StyleLookupValue extends SelectedStyleDisplay {
  styleId: string;
  promptExamples: string[];
}

/**
 * AI 이미지 생성 V2 훅 (RHF + useMutation)
 *
 * - styleId, prompt, assetId를 RHF으로 관리
 * - 비동기 처리: jobId 즉시 반환
 * - Realtime 구독은 ImageGenerationStatus에서 처리
 *
 * @param imageId 이미지 요소 ID (로딩 상태 관리용)
 */
export const useGenerateAIImageV2 = (imageId: string) => {
  const params = useParams();
  const projectId = params.id as string;

  // stale closure 방지용 ref
  const imageIdRef = useRef(imageId);
  imageIdRef.current = imageId;
  const majors = useImageGenerationMajors();
  const pushMoreView = usePushMoreView();
  const clearMoreView = useClearMoreView();

  // Store 셀렉터 통합 (구독 최적화)
  const {
    selectedStyleId: selectedStyleIdFromStore,
    selectedAsset: selectedAssetFromStore,
    activeJob,
    setImageLoading,
    setSelectedStyleId,
    setSelectedAsset,
    resetFormState,
    setActiveJob,
    clearGenerationState,
  } = useImageGenerationStore(
    useShallow((state) => ({
      selectedStyleId: state.selectedStyleId,
      selectedAsset: state.selectedAsset,
      activeJob: state.activeJob,
      setImageLoading: state.setImageLoading,
      setSelectedStyleId: state.setSelectedStyleId,
      setSelectedAsset: state.setSelectedAsset,
      resetFormState: state.resetFormState,
      setActiveJob: state.setActiveJob,
      clearGenerationState: state.clearGenerationState,
    })),
  );

  // 스타일 룩업 맵 생성 (O(1) 조회용)
  const { styleLookup, defaultStyle } = useMemo(() => {
    const lookup = new Map<string, StyleLookupValue>();
    let firstStyle: StyleLookupValue | null = null;

    for (const major of majors) {
      for (const middle of major.middles) {
        for (const style of middle.styles) {
          const value: StyleLookupValue = {
            styleId: style.id,
            majorName: major.name,
            styleName: style.name,
            thumbnailUrl: style.thumbnailUrl,
            promptExamples: style.promptExamples ?? [],
          };
          lookup.set(style.id, value);

          if (!firstStyle) {
            firstStyle = value;
          }
        }
      }
    }

    return { styleLookup: lookup, defaultStyle: firstStyle };
  }, [majors]);

  // RHF 폼 설정 - zustand의 selectedStyleId 우선 사용
  const form = useForm<AIImageFormData>({
    resolver: zodResolver(aiImageFormSchema),
    mode: 'onChange',
    defaultValues: {
      styleId: selectedStyleIdFromStore || defaultStyle?.styleId || '',
      prompt: '',
      assetId: '',
    },
  });

  const { setValue, reset, handleSubmit, control } = form;
  const styleId = useWatch({ control, name: 'styleId' });
  const assetId = useWatch({ control, name: 'assetId' });

  // zustand의 selectedStyleId가 변경되면 form에 반영
  // 단, styleLookup에 존재하는 유효한 ID인 경우에만 적용
  useEffect(() => {
    if (selectedStyleIdFromStore && styleLookup.has(selectedStyleIdFromStore)) {
      setValue('styleId', selectedStyleIdFromStore, { shouldValidate: true });
    }
  }, [selectedStyleIdFromStore, setValue, styleLookup]);

  // zustand의 selectedAsset이 변경되면 form에 반영 (빈 문자열 포함)
  useEffect(() => {
    setValue('assetId', selectedAssetFromStore?.id ?? '', { shouldValidate: true });
  }, [selectedAssetFromStore, setValue]);

  // 현재 선택된 스타일의 표시 정보 (O(1) 조회)
  const selectedStyleDisplay = useMemo((): SelectedStyleDisplay | null => {
    if (!styleId) return null;
    const style = styleLookup.get(styleId);
    if (!style) return null;

    return {
      majorName: style.majorName,
      styleName: style.styleName,
      thumbnailUrl: style.thumbnailUrl,
    };
  }, [styleId, styleLookup]);

  // 스타일 선택 UI용 아이템 목록
  const majorItems = useMemo(
    (): ProductImageItem[] =>
      majors.map((major) => ({
        id: major.id,
        name: major.name,
        thumbnailUrl: major.thumbnailUrl,
        category: 'style_major',
        data: { middles: major.middles },
      })),
    [majors],
  );

  // 스타일 선택 UI 열기
  const openStyleSelector = useCallback(() => {
    pushMoreView(
      TOGGLE_STATES.IMAGE_STYLE_MORE,
      '연출 스타일',
      majorItems,
      (item) => {
        // style_preset 선택 시 zustand에 저장 (패널 전환 후에도 유지)
        if (item.category === 'style_preset') {
          setSelectedStyleId(item.id);
        }
      },
      TOGGLE_STATES.IMAGE,
    );
  }, [majorItems, pushMoreView, setSelectedStyleId]);

  // 참조 이미지 선택 핸들러
  const selectAsset = useCallback(
    (id: string, thumbnailUrl: string) => {
      setSelectedAsset({ id, thumbnailUrl });
    },
    [setSelectedAsset],
  );

  // 참조 이미지 선택 해제
  const clearAsset = useCallback(() => {
    setValue('assetId', '', { shouldValidate: true });
    setSelectedAsset(null);
  }, [setValue, setSelectedAsset]);

  // 현재 선택된 스타일의 랜덤 프롬프트 예시 설정
  const setRandomPromptExample = useCallback(() => {
    if (!styleId) return;
    const style = styleLookup.get(styleId);
    if (!style || style.promptExamples.length === 0) return;

    const randomIndex = Math.floor(Math.random() * style.promptExamples.length);
    const randomExample = style.promptExamples[randomIndex];
    setValue('prompt', randomExample, { shouldValidate: true });
  }, [styleId, styleLookup, setValue]);

  // 선택된 참조 이미지 표시 정보
  const selectedAssetDisplay = useMemo((): SelectedAssetDisplay | null => {
    if (!selectedAssetFromStore) return null;
    return {
      assetId: selectedAssetFromStore.id,
      thumbnailUrl: selectedAssetFromStore.thumbnailUrl,
    };
  }, [selectedAssetFromStore]);

  // 폼 초기화 (zustand 포함)
  const resetForm = useCallback(() => {
    reset({
      styleId: defaultStyle?.styleId ?? '',
      prompt: '',
      assetId: '',
    });
    resetFormState();
  }, [reset, defaultStyle, resetFormState]);

  // Mutation
  const { isPending, mutate } = useMutation({
    mutationKey: mutationKeys.FRAME.aiImage,
    mutationFn: async (formData: AIImageFormData) => {
      if (!projectId) {
        throw new CustomError(400, 'Project ID is not available');
      }
      if (!formData.styleId) {
        throw new CustomError(400, 'Style ID is required');
      }

      // 재생성 여부 확인 (activeJob이 있는 상태에서 submit)
      const isRegeneration = !!activeJob;

      // 재생성 시: 기존 shimmer 해제, imageId 캡처 안 함 (수동 배치)
      // 신규 생성 시: 현재 선택된 imageId 캡처하여 shimmer 표시 및 자동 적용
      if (isRegeneration && activeJob.imageId) {
        setImageLoading(activeJob.imageId, false);
      }

      const capturedImageId = isRegeneration ? '' : imageIdRef.current;
      if (capturedImageId) {
        setImageLoading(capturedImageId, true);
      }

      const result = await generateAIImageV2(projectId, {
        styleId: formData.styleId,
        prompt: formData.prompt || undefined,
        assetId: formData.assetId || undefined,
      });

      // 캡처된 imageId를 결과에 포함하여 onSuccess에서 사용
      return { ...result, capturedImageId };
    },
    retry: 3,
    onSuccess: (result, formData) => {
      // 스타일 선택 화면(moreView) 정리 → IMAGE 패널로 복귀
      clearMoreView();

      // 생성 시점의 정보를 스냅샷으로 저장 (다른 이미지 클릭해도 유지)
      const styleInfo = styleLookup.get(formData.styleId);
      setActiveJob({
        jobId: result.jobId,
        imageId: result.capturedImageId, // 캡처된 imageId 사용
        styleDisplay: styleInfo
          ? {
              majorName: styleInfo.majorName,
              styleName: styleInfo.styleName,
              thumbnailUrl: styleInfo.thumbnailUrl,
            }
          : null,
        prompt: formData.prompt || '',
        assetDisplay: selectedAssetFromStore
          ? {
              assetId: selectedAssetFromStore.id,
              thumbnailUrl: selectedAssetFromStore.thumbnailUrl,
            }
          : null,
      });
    },
    onError: (error) => {
      // 에러 발생 시 shimmer 해제 (신규 생성의 경우만 해당)
      // 재생성의 경우 이미 mutationFn에서 shimmer 해제됨
      if (imageIdRef.current) {
        setImageLoading(imageIdRef.current, false);
      }
      showToast.error('이미지 생성에 실패했어요. 다시 시도해주세요.');
      console.error(`[AI 이미지 생성 V2] ❌ 실패`, error);
    },
  });

  // 폼 제출 핸들러
  const onSubmit = handleSubmit(async (data) => {
    if (!(await confirmAiImages({ count: 1 }))) return;
    mutate(data);
  });

  return {
    form,
    onSubmit,
    isPending,
    styleId,
    assetId,
    selectedStyleDisplay,
    selectedAssetDisplay,
    openStyleSelector,
    hasStyles: majors.length > 0,
    selectAsset,
    clearAsset,
    resetForm,
    setRandomPromptExample,
    // 생성 상태
    activeJob,
    clearGenerationState,
  };
};

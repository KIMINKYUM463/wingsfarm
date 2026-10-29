import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { ENDPOINTS } from '@/shared/constants/endpoints';
import httpClient from '@/shared/lib/httpClient';
import type { GenerateAITextRequest, GenerateAITextResponse } from '@/features/detail-page/types';
import type { KonvaFrameElement } from '@/shared/types/konva';
import { useCanvasDataStore } from '@/features/editor/store/useCanvasDataStore';
import { useTextGenerationStore } from '@/features/editor/store/useTextGenerationStore';
import { CustomError } from '@/shared/lib/CustomError';
import { showToast, toast } from '@/utils/toast';
import { textGeneratorSchema, type TextGeneratorData } from '@/validation/textGenerator.schema';
import { useModeStore } from '@/features/editor/store/useModeStore';
import { mutationKeys } from '@/shared/constants/mutationKeys';

/**
 * 개별 AI 텍스트 생성 요청 (prompt 포함)
 */
interface GenerateIndividualAITextRequest extends GenerateAITextRequest {
  prompt: string;
}

/**
 * 개별 AI 텍스트 생성 API 호출
 */
async function generateIndividualAIText(
  projectId: string,
  request: GenerateIndividualAITextRequest,
): Promise<GenerateAITextResponse> {
  const response = await httpClient.post<{
    isSuccess: boolean;
    code: string;
    message: string;
    data: GenerateAITextResponse;
  }>(ENDPOINTS.DETAIL_PAGE.GENERATE_AI_TEXT(projectId), request, { withAuth: true });
  return response.data;
}

/**
 * 개별 AI 텍스트 생성 훅 (react-hook-form + useMutation)
 *
 * @param elementId 텍스트 요소 ID
 * @param frameData 프레임 데이터
 */
export const useGenerateIndividualAIText = (elementId: string, frameData: KonvaFrameElement) => {
  const params = useParams();
  const projectId = params.id as string; // edit 페이지의 URL에서 직접 projectId 추출
  const setTextContent = useCanvasDataStore((state) => state.setTextContent);
  const setTextLoading = useTextGenerationStore((state) => state.setTextLoading);
  const unselectElement = useModeStore((state) => state.unselectElement);

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<TextGeneratorData>({
    resolver: zodResolver(textGeneratorSchema),
    mode: 'onChange',
    defaultValues: {
      prompt: '',
    },
  });

  const { isPending, mutate } = useMutation({
    mutationKey: mutationKeys.FRAME.aiText,
    mutationFn: async (formData: TextGeneratorData) => {
      if (!projectId) {
        throw new CustomError(400, 'Project ID is not available');
      }

      // 텍스트 로딩 시작
      setTextLoading(elementId, true);

      const request: GenerateIndividualAITextRequest = {
        projectId,
        elementId,
        frameData,
        prompt: formData.prompt,
      };

      return generateIndividualAIText(projectId, request);
    },
    // 재시도 설정 (중간 실패는 조용히 재시도, 최종 실패 시에만 onError 호출)
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000), // exponential backoff
    onMutate: () => {
      // 로딩 토스트 표시
      const loadingToastId = showToast.info('AI가 텍스트를 생성 중이에요.');
      return { loadingToastId };
    },
    onSuccess: (result, _variables, context) => {
      // 1. 화면에 즉시 반영
      setTextContent(result.elementId, result.text);
      setTextLoading(result.elementId, false);

      // 2. 선택 상태 초기화 (텍스트 변경이 화면에 즉시 반영되도록)
      unselectElement();

      // 3. 로딩 토스트 제거
      if (context?.loadingToastId) {
        toast.dismiss(context.loadingToastId);
      }

      // 4. 성공 토스트 표시
      showToast.success('텍스트가 완성됐어요.');
    },
    onError: (error, _variables, context) => {
      // 최종 실패: 모든 재시도 완료 후에만 호출됨 (3회 시도 후)
      setTextLoading(elementId, false);

      // 로딩 토스트 제거
      if (context?.loadingToastId) {
        toast.dismiss(context.loadingToastId);
      }

      // 실패 토스트 표시 (최종 실패 시에만)
      showToast.error('텍스트 생성에 실패했어요. 다시 시도해주세요.');
      console.error(`[개별 AI 텍스트 생성] ❌ 최종 실패 (3회 시도): ${elementId}`, error);
    },
  });

  const onSubmit = handleSubmit((formData) => {
    mutate(formData);
  });

  return { register, isPending, onSubmit, errors, isValid };
};

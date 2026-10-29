import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ENDPOINTS } from '@/shared/constants/endpoints';
import httpClient from '@/shared/lib/httpClient';
import { apiKeySchema, type ApiKeyFormData } from '@/validation/apiKey.schema';
import { mutationKeys } from '@/shared/constants/mutationKeys';
import { queryKeys } from '@/shared/constants/queryKeys';
import { CustomError } from '@/shared/lib/CustomError';
import { handleAppError } from '@/utils/errorHandler';

interface ApiKeyResponse {
  id: string;
  maskedKey: string;
  isActive: boolean;
}

/**
 * API 키 설정 훅 (조회 + 저장)
 *
 * @param initialData 서버에서 미리 조회한 API 키 데이터 (SSR 최적화)
 */
export const useApiKeySettings = (initialData?: ApiKeyResponse | null) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const { data: existingKey, isLoading } = useQuery({
    queryKey: queryKeys.SETTINGS.apiKey(),
    queryFn: async () => {
      const response = await httpClient.get<{
        isSuccess: boolean;
        data: ApiKeyResponse | null;
      }>(ENDPOINTS.SETTINGS.API_KEY, { withAuth: true });
      return response.data;
    },
    initialData: initialData ?? undefined,
    staleTime: Infinity,
  });

  const {
    register,
    handleSubmit,
    reset: resetForm,
    formState: { errors },
  } = useForm<ApiKeyFormData>({
    resolver: zodResolver(apiKeySchema),
    mode: 'onChange',
    defaultValues: {
      apiKey: '',
    },
  });

  const queryClient = useQueryClient();

  const { isPending, isSuccess: justSaved, isError: isSaveError, mutate, reset } = useMutation({
    mutationKey: mutationKeys.SETTINGS.apiKey,
    meta: { skipGlobalError: true },
    mutationFn: async (formData: ApiKeyFormData) => {
      const response = await httpClient.post<{
        isSuccess: boolean;
        data: ApiKeyResponse;
      }>(ENDPOINTS.SETTINGS.API_KEY, { apiKey: formData.apiKey }, { withAuth: true });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.SETTINGS.apiKey() });
      setIsEditMode(false);
    },
    onError: (error) => {
      const is400 = error instanceof CustomError && error.status === 400;
      if (!is400) handleAppError(error);
    },
  });

  const { mutate: deleteKey, isPending: isDeleting } = useMutation({
    mutationKey: mutationKeys.SETTINGS.deleteApiKey,
    mutationFn: async () => {
      await httpClient.delete(ENDPOINTS.SETTINGS.API_KEY, { withAuth: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.SETTINGS.apiKey() });
      reset();
    },
  });

  const onSubmit = handleSubmit((formData) => {
    mutate(formData);
  });

  const handleEdit = () => {
    setIsEditMode(true);
    resetForm();
    reset();
  };

  const handleCancel = () => {
    setIsEditMode(false);
    reset();
  };

  const savedKey = existingKey ?? null;
  const isInputMode = !savedKey || isEditMode;

  return {
    register,
    isPending,
    isDeleting,
    isLoading,
    onSubmit,
    errors,
    savedKey,
    justSaved,
    isSaveError,
    isInputMode,
    isEditMode,
    onEdit: handleEdit,
    onCancel: handleCancel,
    onDelete: deleteKey,
  };
};

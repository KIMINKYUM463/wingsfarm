import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CopyModelId, CopyModelInfo } from '@/shared/constants/copyModels';
import { ENDPOINTS } from '@/shared/constants/endpoints';
import { mutationKeys } from '@/shared/constants/mutationKeys';
import { queryKeys } from '@/shared/constants/queryKeys';
import httpClient from '@/shared/lib/httpClient';

type Response = { isSuccess: boolean; data: CopyModelInfo };

/** 판매 문구 AI 선택 (조회 + 저장) */
export const useCopyModel = (initialData: CopyModelInfo) => {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.SETTINGS.copyModel();

  const { data = initialData } = useQuery({
    queryKey,
    queryFn: async () => (await httpClient.get<Response>(ENDPOINTS.SETTINGS.COPY_MODEL, { withAuth: true })).data,
    initialData,
    staleTime: Infinity,
  });

  const { mutate, isPending, isSuccess } = useMutation({
    mutationKey: mutationKeys.SETTINGS.copyModel,
    mutationFn: async (model: CopyModelId) => (await httpClient.put<Response>(ENDPOINTS.SETTINGS.COPY_MODEL, { model }, { withAuth: true })).data,
    onSuccess: (saved) => queryClient.setQueryData(queryKey, saved),
  });

  return { info: data, select: mutate, isPending, justSaved: isSuccess };
};

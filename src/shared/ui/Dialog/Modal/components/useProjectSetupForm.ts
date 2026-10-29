import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { matchCategory } from '@/features/detail-page/api';
import {
  projectSetupFormSchema,
  type ProjectSetupFormData,
} from '@/validation/projectSetupForm.schema';

interface UseProjectSetupFormParams {
  onCategorySelected?: (data: { productName: string; categoryId: string }) => void;
}

/**
 * ProjectSetupModal 폼 상태 + 카테고리 매칭 훅
 *
 * 상품명 입력 → AI 카테고리 매칭 → 카테고리 선택 플로우 관리
 */
export const useProjectSetupForm = ({ onCategorySelected }: UseProjectSetupFormParams = {}) => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const {
    register,
    handleSubmit: hookFormSubmit,
    formState,
    getValues,
  } = useForm<ProjectSetupFormData>({
    mode: 'onChange',
    resolver: zodResolver(projectSetupFormSchema),
    defaultValues: { productName: '' },
  });

  const {
    mutate: matchCategoryMutation,
    isPending,
    data,
    reset: resetMutation,
  } = useMutation({
    mutationFn: matchCategory,
    retry: 2,
    onSuccess: (responseData) => {
      setSelectedCategory(responseData.recommended);
    },
  });

  const categories = data?.categories ?? [];

  /** 폼 제출 핸들러 - 카테고리 없으면 매칭, 있으면 콜백 호출 */
  const handleSubmit = hookFormSubmit(() => {
    if (categories.length === 0) {
      matchCategoryMutation({ keyword: getValues().productName, language: 'ko' });
      return;
    }

    if (!selectedCategory) return;

    onCategorySelected?.({ productName: getValues().productName, categoryId: selectedCategory });
  });

  /** 카테고리 선택 핸들러 */
  const handleCategoryClick = (categoryId: string) => {
    setSelectedCategory(categoryId);
  };

  /** 이전 단계로 돌아가기 (카테고리 및 mutation 초기화) */
  const resetCategories = () => {
    setSelectedCategory(null);
    resetMutation();
  };

  return {
    selectedCategory,
    categories,
    register,
    handleSubmit,
    handleCategoryClick,
    resetCategories,
    isPending,
    isValid: formState.isValid,
    getValues,
  };
};

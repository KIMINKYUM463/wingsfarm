'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import { ChoiceCard } from '@/features/draft/components/ui';
import { TEMPLATE_START_LENGTHS, type TemplateStartLength } from '@/shared/constants/templateStart';
import Button from '@/shared/ui/Button/Button';
import ModalContent from '../ModalContent';
import type { ModalComponentProps } from '../types';
import CategoryCard from './CategoryCard';
import { useProjectSetupForm } from './useProjectSetupForm';
import { useCreateProject } from '@/features/detail-page/hooks/useCreateProject';
import Input from '@/shared/ui/Input/Input';
import Spinner from '@/shared/ui/Spinner/Spinner';
import { ROUTES } from '@/shared/constants/routes';
import type { Route } from 'next';

/** ProjectSetupModal - 상품명 입력 및 카테고리 선택 모달 */
const ProjectSetupModal = ({ data, onClose }: ModalComponentProps) => {
  const router = useRouter();
  const openInNewTab = data?.openInNewTab === true;
  const [length, setLength] = useState<TemplateStartLength>('short');

  const {
    mutate: createProject,
    isPending: isCreatingProject,
    isSuccess: isNavigating,
  } = useCreateProject();

  // 프로젝트 생성 중 또는 페이지 이동 중 로딩 유지
  const isSubmitting = isCreatingProject || isNavigating;

  const {
    selectedCategory,
    categories,
    register,
    handleSubmit,
    handleCategoryClick,
    resetCategories,
    isPending: isMatchingCategory,
    isValid,
    getValues,
  } = useProjectSetupForm({
    onCategorySelected: ({ productName, categoryId }) => {
      createProject(
        { productName, categoryId, length },
        {
          onSuccess: (response) => {
            const url = `${ROUTES.PROJECT(response.id)}?draft=true` as Route;

            if (openInNewTab) {
              // 새 탭에서 열기 (에디터 내에서 호출 시)
              window.open(url, '_blank');
              onClose();
            } else {
              // 같은 탭에서 이동 (기본 동작)
              router.push(url);
            }
          },
        },
      );
    },
  });

  const hasCategories = categories.length > 0;

  return (
    <ModalContent onClose={onClose} className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-xl bg-white p-5 sm:p-9" maxW="lg">
      <form
        onSubmit={handleSubmit}
        className={clsx(
          'flex flex-col items-end',
          hasCategories || isMatchingCategory ? 'sm:h-180' : 'sm:h-60',
        )}
      >
        <div className="flex flex-col gap-9 w-full flex-1">
          <div className="flex flex-col gap-3">
            <p className="h3-bold text-(--color-point)">상세페이지 생성 준비</p>
            {hasCategories || isMatchingCategory ? (
              <h2 className="h2-bold truncate">
                {getValues('productName')} 카테고리를 찾아드렸어요.
              </h2>
            ) : (
              <h2 className="h2-bold">상품명을 알려주세요.</h2>
            )}
          </div>

          {/* Step 1: 상품명 입력 */}
          {!hasCategories && !isMatchingCategory && (
            <Input
              {...register('productName')}
              className="input-single w-full placeholder:text-gray-300"
              placeholder="예: 맨투맨 / 무선 이어폰 / 립스틱"
              autoFocus
            />
          )}

          {/* Step 2: 카테고리 매칭 중 로딩 */}
          {isMatchingCategory && (
            <div className="w-full flex flex-col items-center text-center justify-center text-gray-500 flex-1">
              <Spinner className="text-gray-400 mb-3" />
              <p className="title-1 mb-2">AI가 카테고리를 고르고 있어요.</p>
              <p className="description">잠시만 기다려주세요.</p>
            </div>
          )}

          {/* Step 3: 카테고리 선택 */}
          {hasCategories && !isMatchingCategory && (
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-5 sm:gap-x-[1.4063rem] sm:gap-y-6">
              {categories.map((category) => (
                <CategoryCard
                  key={category.id}
                  name={category.name}
                  imageUrl={category.imageUrl}
                  selected={selectedCategory === category.id}
                  onClick={() => handleCategoryClick(category.id)}
                />
              ))}
            </div>
          )}

          {/* 버튼 영역 */}
          <div
            className={clsx(
              'flex-1 flex flex-col items-end justify-end gap-6',
              isMatchingCategory && 'hidden',
            )}
          >
            {/* 페이지 길이 + 안내 문구 */}
            {hasCategories && (
              <div className="flex w-full flex-col gap-3">
                <div className="flex w-full gap-2" role="radiogroup" aria-label="페이지 길이">
                  {TEMPLATE_START_LENGTHS.map((option) => (
                    <ChoiceCard
                      key={option.id}
                      selected={length === option.id}
                      onClick={() => setLength(option.id)}
                      title={option.title}
                      description={option.description}
                    />
                  ))}
                </div>
                <p className="description text-gray-300 text-right">
                  * 선택된 카테고리가 아니라면 변경하실 수 있습니다.
                </p>
              </div>
            )}
            <div className="flex gap-3">
              {hasCategories && (
                <Button type="button" onClick={resetCategories} className="btn-cancel">
                  <span className="p">이전</span>
                </Button>
              )}
              <Button
                className="btn-primary"
                type="submit"
                disabled={hasCategories ? !selectedCategory : !isValid}
                isLoading={isSubmitting}
              >
                <span className="p">다음</span>
              </Button>
            </div>
          </div>
        </div>
      </form>
    </ModalContent>
  );
};

export default ProjectSetupModal;

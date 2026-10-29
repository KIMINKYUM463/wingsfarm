import { useWatch } from 'react-hook-form';
import Image from 'next/image';
import Input from '@/shared/ui/Input/Input';
import LabelInput from '@/shared/ui/LabelInput';
import FileInput from '@/shared/ui/FileInput';
import Icon from '@/shared/ui/Icon';
import Button from '@/shared/ui/Button/Button';
import ToggleSelectGroup from '@/shared/ui/ToggleSelectGroup';
import UploadedImagePreview from '@/features/detail-page/components/UploadedImagePreview';
import Skeleton from '@/shared/ui/Skeleton/Skeleton';
import { ILLUSTRATIONS } from '@/shared/constants/assets';
import { ROUTES } from '@/shared/constants/routes';
import { useGenerateKeywords } from '@/features/detail-page/hooks/useGenerateKeywords';
import type { Step3Props } from '../types';

const Step3KeywordSelection = ({
  form,
  projectId,
  generationMethod,
  referenceImagePreviews,
  isUploadingReference,
  createUrlUpdateHandler,
  handleRemoveImage,
}: Step3Props) => {
  const { register, control, getValues, setValue } = form;

  const generationData = useWatch({ control, name: 'generationData' }) as {
    keywordSelection?: {
      keywordData?: { groups: { name: string; keywords: string[] }[] };
    };
  } | undefined;

  // 그룹별 선택된 키워드 가져오기
  const getSelectedKeywords = (groupName: string): string[] => {
    const groups = generationData?.keywordSelection?.keywordData?.groups || [];
    return groups.find((g) => g.name === groupName)?.keywords || [];
  };

  // AI 키워드 데이터 (AiDetailPageModal에서 프리페치됨)
  const {
    data: keywordData,
    isLoading,
    error,
    refetch,
  } = useGenerateKeywords(projectId, {
    enabled: generationMethod === 'keyword_selection',
  });

  // 키워드 선택 핸들러 - generationData 전체 재설정 (discriminatedUnion 대응)
  const handleKeywordChange = (groupName: string) => (selectedKeywords: string[]) => {
    const currentData = getValues('generationData') as {
      keywordSelection?: {
        keywordData?: { groups: { name: string; keywords: string[] }[] };
        customFeatures?: string;
      };
    };

    const currentGroups = currentData?.keywordSelection?.keywordData?.groups || [];
    const groupExists = currentGroups.some((g) => g.name === groupName);

    // 기존 그룹 업데이트 또는 새 그룹 추가
    const updatedGroups = groupExists
      ? currentGroups.map((g) => (g.name === groupName ? { ...g, keywords: selectedKeywords } : g))
      : [...currentGroups, { name: groupName, keywords: selectedKeywords }];

    // 빈 키워드 그룹 제거
    const filteredGroups = updatedGroups.filter((g) => g.keywords.length > 0);

    // generationData 전체 재설정 (customFeatures 유지)
    setValue(
      'generationData',
      {
        keywordSelection: {
          keywordData: filteredGroups.length > 0 ? { groups: filteredGroups } : undefined,
          customFeatures: currentData?.keywordSelection?.customFeatures || '',
        },
      } as never,
      { shouldValidate: true },
    );
  };

  return (
    <div>
      {generationMethod === 'keyword_selection' && (
        <div>
          <LabelInput title="이 상품만의 특별한 특징을 선택하거나 직접 입력해 주세요." isEssential>
            {isLoading && (
              <div className="flex flex-col gap-3">
                <Skeleton bg="gray-50" className="h-(--btn-h) w-full rounded-lg" />
                <Skeleton bg="gray-50" className="h-(--btn-h) w-full rounded-lg" />
                <Skeleton bg="gray-50" className="h-(--btn-h) w-full rounded-lg" />
                <Skeleton bg="gray-50" className="h-(--btn-h) w-full rounded-lg" />
              </div>
            )}

            {error && (
              <div className="text-center py-8">
                <p className="p text-red-500">키워드 생성에 실패했습니다.</p>
                <Button type="button" className="btn-ghost mt-4" onClick={() => refetch()}>
                  다시 시도
                </Button>
              </div>
            )}

            {!isLoading && !error && keywordData && (
              <div className="space-y-3" data-field="keywordData">
                {keywordData.groups.map((group) => (
                  <ToggleSelectGroup
                    key={group.name}
                    title={group.name}
                    options={group.keywords.map((keyword) => ({
                      id: keyword,
                      label: keyword,
                    }))}
                    defaultValue={getSelectedKeywords(group.name)}
                    onChange={handleKeywordChange(group.name)}
                  />
                ))}
              </div>
            )}
          </LabelInput>

          <Input
            {...register('generationData.keywordSelection.customFeatures')}
            className="mt-3 border focus:border-(--color-point) border-gray-100 py-2.75 px-3 rounded-lg w-full"
            placeholder="상품의 특별한 이야기나 장점을 적어주세요. (500자 이내)"
          />
        </div>
      )}

      {generationMethod === 'image_upload' && (
        <div>
          <div className="flex-col sm:flex-row sm:gap-0 gap-4 flex justify-between pb-2">
            <div className="flex gap-3 items-center">
              <Image src={ILLUSTRATIONS.SaveScreen} alt="SaveScreen" width={30} height={30} />
              <div>
                <p className="p-bold">SaveScreen으로 캡처하기</p>
                <p className="description text-gray-300">
                  크롬 확장 프로그램을 사용하면 전체 상세페이지를 한번에 캡쳐할 수 있어요.{' '}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <a
                href={ROUTES.GUIDE_EXTENSION}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost px-3 h-8 flex-center"
              >
                <span className="description text-gray-400">사용설명</span>
              </a>
              <a
                href="https://chromewebstore.google.com/detail/savescreen/mgnfgihlbpddpcbckcdpbdklniofiidb?hl=ko&utm_source=ext_sidebar"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary px-3 h-8 flex-center"
              >
                <span className="description">바로가기</span>
              </a>
            </div>
          </div>
          <FileInput
            onChange={createUrlUpdateHandler('generationData.imageUpload.detailPageUrls')}
            wrapClassName="w-full"
            className="form-create w-full text-gray-400 mt-6"
            labelText="벤치마킹 이미지 업로드"
            textClassName="p"
            id="detailPageUrls"
            icon={<Icon name="image" className="text-gray-400" />}
            multiple
          />
          <UploadedImagePreview
            images={referenceImagePreviews}
            onRemove={handleRemoveImage('generationData.imageUpload.detailPageUrls')}
            isUploading={isUploadingReference}
          />
        </div>
      )}
    </div>
  );
};

export default Step3KeywordSelection;

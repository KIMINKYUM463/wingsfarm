'use client';

import Image from 'next/image';
import IconButton from '@/shared/ui/Button/IconButton';
import ActionTooltip from '@/shared/ui/Tooltip/ActionTooltip';
import CloseButton from '@/shared/ui/Button/CloseButton';
import CustomIcon from '@/shared/ui/CustomIcon';
import Icon from '@/shared/ui/Icon';
import TextArea from '@/shared/ui/TextArea';
import Spinner from '@/shared/ui/Spinner/Spinner';
import Badge from '@/shared/ui/Badge';
import type { UseFormRegister, FieldValues } from 'react-hook-form';
import type { SelectedAssetDisplay } from '@/features/editor/hooks/useGenerateAIImageV2';

interface ResultDescriptionProps<T extends FieldValues> {
  formId: string;
  onSubmit: (e?: React.BaseSyntheticEvent) => void;
  register: UseFormRegister<T>;
  isPending: boolean;
  selectedAsset?: SelectedAssetDisplay | null;
  onClearAsset?: () => void;
  /** 이미지 추가 버튼 클릭 핸들러 (파일 선택창 열기) */
  onAddClick?: () => void;
  /** 이미지 업로드 중 여부 */
  isUploading?: boolean;
  /** 예시 생성 버튼 클릭 핸들러 */
  onGenerateExample?: () => void;
}

const ResultDescription = <T extends FieldValues>({
  formId,
  onSubmit,
  register,
  isPending,
  selectedAsset,
  onClearAsset,
  onAddClick,
  isUploading,
  onGenerateExample,
}: ResultDescriptionProps<T>) => {
  // 업로드 중이거나 선택된 에셋이 있으면 textarea에 왼쪽 패딩 적용
  const hasLeftContent = isUploading || selectedAsset;
  return (
    <form id={formId} onSubmit={onSubmit}>
      <div className="mb-2 flex items-center gap-2">
        <p>결과물 상세 설명</p>
        <Badge type="required" />
      </div>
      <p className="text-(--color-placeholder)">
        제품 이미지를 올리면, 제품이 포함된 연출 이미지로 만들어줍니다.
      </p>
      <div className="form-single relative mt-4 h-45 px-3 py-4">
        {/* 참조 이미지 썸네일 또는 업로드 로딩 */}
        {hasLeftContent && (
          <div className="absolute top-3 left-3 group">
            <div className="flex-center relative size-20 overflow-hidden rounded-lg border border-gray-100 bg-white">
              {isUploading && !selectedAsset ? (
                <Spinner size={24} />
              ) : selectedAsset ? (
                <>
                  <Image
                    src={selectedAsset.thumbnailUrl}
                    alt="참조 이미지"
                    fill
                    className="object-cover"
                    sizes="80px"
                  />
                  <CloseButton
                    variant="solid"
                    onClick={onClearAsset}
                    iconSize={18}
                    className="top-1.5 right-1.5"
                    ariaLabel="이미지 제거"
                  />
                </>
              ) : null}
            </div>
          </div>
        )}

        <TextArea
          {...register('prompt' as any)}
          className={hasLeftContent ? 'h-full w-full pl-24' : 'h-full w-full'}
          placeholder="만들고자 하는 결과물에 대해 자세히 설명해 주세요."
          disabled={isPending}
          maxLength={1000}
        />
        <ActionTooltip content="업로드" direction="right">
          <IconButton
            customIcon={<Icon name="add" width={20} height={20} weight={500} color="var(--color-point)" />}
            onClick={onAddClick}
            className="btn-secondary-md absolute bottom-3 left-3 rounded-full p-1"
          />
        </ActionTooltip>
        <IconButton
          customIcon={
            <CustomIcon name="ai-star" className="text-(--color-point)" width={16} height={16} />
          }
          text="예시생성"
          textClassName="description"
          className="btn-secondary-md absolute right-3 bottom-2"
          onClick={onGenerateExample}
        />
      </div>
    </form>
  );
};

export default ResultDescription;

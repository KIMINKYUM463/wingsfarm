'use client';
import { useCallback, useId, useMemo } from 'react';
import { useParams } from 'next/navigation';
import ResultDescription from '@/features/editor/components/panel/common/ResultDescription';
import {
  ToolSectionLayout,
  ToolFixedButtonSection,
} from '@/features/editor/components/panel/common';
import Spinner from '@/shared/ui/Spinner/Spinner';
import Empty from '@/shared/ui/Empty';
import AssetGrid from '@/features/editor/components/panel/file/AssetGrid';
import { useGenerateAIImageV2 } from '@/features/editor/hooks/useGenerateAIImageV2';
import { useSelectedElement } from '@/features/editor/hooks/useSelectedElement';
import { isImageElement } from '@/features/editor/lib/element-finder';
import { useAssets } from '@/features/assets';
import FileInput from '@/shared/ui/FileInput/FileInput';
import { useAssetUpload } from '@/features/editor/hooks/useAssetUpload';
import { StyleSelector } from './style';
import ImageGenerationStatus, { type RegenerateRequest } from './ImageGenerationStatus';
import ImageAdjustSection from './ImageAdjustSection';
import type { KonvaPathElement, KonvaRectElement } from '@/shared/types/konva';

const ImageTool = () => {
  const params = useParams();
  const projectId = params.id as string;
  const { element: selectedElement, elements: selectedElements } = useSelectedElement();
  const formId = useId();

  // 이미지 요소가 선택되었는지 확인
  const isImageSelected = selectedElement && isImageElement(selectedElement);
  // 사진이 들어 있는 칸만 사진 편집 대상
  const photoElements = useMemo(
    () =>
      selectedElements.filter(
        (el): el is KonvaRectElement | KonvaPathElement =>
          isImageElement(el) && 'assetId' in el && Boolean(el.assetId),
      ),
    [selectedElements],
  );

  // AI 이미지 생성 V2 훅 (RHF + mutation)
  const {
    form,
    onSubmit,
    isPending,
    selectedStyleDisplay,
    selectedAssetDisplay,
    openStyleSelector,
    assetId: selectedAssetId,
    selectAsset,
    clearAsset,
    setRandomPromptExample,
    // 생성 상태 (스냅샷)
    activeJob,
    clearGenerationState,
  } = useGenerateAIImageV2(isImageSelected ? selectedElement.id : '');


  // 다시 생성하기 핸들러 (추가 편집 프롬프트 + 생성된 이미지로 재생성)
  // 재생성은 새 이미지를 만드는 것이므로 기존 요소 참조를 끊고 수동 배치하도록 함
  const handleRegenerate = useCallback(
    ({ editPrompt, generatedImage }: RegenerateRequest) => {
      // 1. 생성된 이미지를 참조 이미지로 설정
      selectAsset(generatedImage.assetId, generatedImage.imageUrl);

      // 2. RHF 폼 값 업데이트 (기존 폼 로직 재사용)
      form.setValue('assetId', generatedImage.assetId, { shouldValidate: true });
      form.setValue('prompt', editPrompt, { shouldValidate: true });

      // 3. 바로 submit (activeJob 유지하여 UI 깜빡임 방지)
      // mutation에서 activeJob 존재 시 재생성으로 인식하여 imageId 캡처 안 함
      onSubmit();
    },
    [selectAsset, form, onSubmit],
  );

  const { assets, total, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } = useAssets({
    limit: 45,
  });

  // 단일 파일 업로드 (플러스 버튼용 - 업로드 후 자동 선택)
  const {
    inputRef: uploadInputRef,
    openFilePicker: openUploadPicker,
    handleFileChange,
    isPending: isUploading,
    markComplete: markUploadComplete,
    uploadingCount,
  } = useAssetUpload({ single: true });

  // 플러스 버튼용 파일 변경 핸들러 (업로드 후 자동 선택)
  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleFileChange(e, {
        waitForCallback: true,
        onSuccess: (uploadedAssets) => {
          const firstAsset = uploadedAssets[0];
          if (firstAsset) {
            selectAsset(firstAsset.assetId, firstAsset.signedUrl);
          }
          markUploadComplete();
        },
      });
    },
    [handleFileChange, selectAsset, markUploadComplete],
  );

  const hasAssets = assets.length > 0 || uploadingCount > 0;

  // 참조 이미지 선택 핸들러
  const handleAssetSelect = useCallback(
    (ids: string[]) => {
      const selectedId = ids[0];
      if (!selectedId) {
        clearAsset();
        return;
      }

      const asset = assets.find((a) => a.id === selectedId);
      if (asset) {
        selectAsset(selectedId, asset.thumbnailUrl ?? asset.signedUrl ?? '');
      }
    },
    [assets, selectAsset, clearAsset],
  );

  const renderAssetContent = () => {
    if (isLoading) {
      return (
        <div className="flex justify-center py-8">
          <Spinner className="text-(--color-point)" />
        </div>
      );
    }

    if (!hasAssets) {
      return (
        <Empty
          texts={['아직 추가된 이미지가 없습니다.', '이미지를 업로드하거나 AI로 생성해보세요.']}
          textClassName="description"
        />
      );
    }

    return (
      <AssetGrid
        assets={assets}
        total={total}
        showHeader={false}
        uploadingCount={uploadingCount}
        selectionMode="single"
        selectedIds={selectedAssetId ? [selectedAssetId] : []}
        onSelectionChange={handleAssetSelect}
      />
    );
  };

  // 생성 상태 UI 표시 여부 (activeJob이 있으면 생성 진행 중)
  // activeJob의 스냅샷 데이터를 사용하여 다른 이미지 클릭해도 정보 유지
  // key={jobId}로 "다시 생성하기" 시 컴포넌트 재마운트 → 상태 리셋
  if (activeJob) {
    return (
      <ImageGenerationStatus
        key={activeJob.jobId}
        projectId={projectId}
        jobId={activeJob.jobId}
        imageId={activeJob.imageId}
        selectedStyle={activeJob.styleDisplay}
        prompt={activeJob.prompt}
        selectedAsset={activeJob.assetDisplay}
        onCancel={clearGenerationState}
        onRegenerate={handleRegenerate}
        isRegenerating={isPending}
      />
    );
  }

  return (
    <>
      {/* 단일 파일 업로드 (플러스 버튼용) */}
      <FileInput
        ref={uploadInputRef}
        accept="image/*"
        onChange={handleFileUpload}
        wrapClassName="hidden"
      />
      <ToolSectionLayout
        title="AI 이미지"
        footer={
          <ToolFixedButtonSection
            buttonText="생성하기"
            formId={formId}
            isLoading={isPending}
            disabled={!form.formState.isValid}
          />
        }
        infiniteScroll={{ hasNextPage, isFetchingNextPage, fetchNextPage }}
      >
        {photoElements.length > 0 && <ImageAdjustSection elements={photoElements} />}
        <StyleSelector selected={selectedStyleDisplay} onClick={openStyleSelector} />
        <ResultDescription
          formId={formId}
          onSubmit={onSubmit}
          register={form.register}
          isPending={isPending}
          selectedAsset={selectedAssetDisplay}
          onClearAsset={clearAsset}
          onAddClick={openUploadPicker}
          isUploading={isUploading}
          onGenerateExample={setRandomPromptExample}
        />
        <div className="-mt-2">{renderAssetContent()}</div>
      </ToolSectionLayout>
    </>
  );
};

export default ImageTool;

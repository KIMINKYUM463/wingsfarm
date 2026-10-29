import { useCallback } from 'react';
import AssetGrid from '@/features/editor/components/panel/file/AssetGrid';
import {
  ToolSectionLayout,
  ToolFixedButtonSection,
} from '@/features/editor/components/panel/common';
import IconInputField from '@/shared/ui/Input/IconInputField';
import FileInput from '@/shared/ui/FileInput/FileInput';
import { useAssetUpload } from '@/features/editor/hooks/useAssetUpload';
import { useAssets, useBulkDeleteAssets, useDownloadAssets } from '@/features/assets';
import { useDebouncedSearch } from '@/shared/hooks/useDebouncedSearch';
import { useActiveFrames } from '@/features/editor/store/useCanvasDataStore';
import { useElementStore } from '@/features/editor/store/useElementStore';
import { useCenteredFrame } from '@/features/editor/hooks/useCenteredFrame';
import { useScrollToElement } from '@/features/editor/hooks/useScrollToElement';

const FileTool = () => {
  const { query: searchQuery, setQuery: setSearchQuery, searchParam } = useDebouncedSearch();

  const { inputRef, openFilePicker, handleFileChange, isPending, uploadingCount } =
    useAssetUpload();
  const { assets, total, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } = useAssets({
    limit: 45,
    search: searchParam,
  });
  const {
    selectedIds,
    setSelectedIds,
    deleteSelected,
    isPending: isDeleting,
  } = useBulkDeleteAssets();
  const { download, isDownloading } = useDownloadAssets();

  // 이미지 추가용 hooks
  const activeFrames = useActiveFrames();
  const { addImageToFrame } = useElementStore();
  const { getCenteredFrame } = useCenteredFrame();
  const { scrollToPosition } = useScrollToElement();

  // 이미지 클릭 시 현재 뷰포트 프레임에 이미지 추가
  const handleImageClick = useCallback(
    (assetId: string, imageUrl: string) => {
      if (activeFrames.length === 0) return;

      // viewport 중심에 가장 가까운 active 프레임 찾기
      const centeredFrame = getCenteredFrame(activeFrames);
      if (!centeredFrame) return;

      addImageToFrame(centeredFrame.id, assetId, imageUrl);

      // 이미지가 추가될 위치 (프레임 중앙)로 스크롤
      setTimeout(() => {
        const centerX = (centeredFrame.width ?? 860) / 2;
        const centerY = (centeredFrame.height ?? 1080) / 2;
        scrollToPosition(centeredFrame.id, centerX, centerY, {
          behavior: 'smooth',
          delay: 100,
        });
      }, 100);
    },
    [activeFrames, getCenteredFrame, addImageToFrame, scrollToPosition],
  );

  return (
    <>
      {/* hidden input은 항상 렌더링 (isEmpty와 무관하게 업로드 가능해야 함) */}
      <FileInput
        ref={inputRef}
        accept="image/*"
        multiple
        onChange={handleFileChange}
        wrapClassName="hidden"
      />
      <ToolSectionLayout
        title="업로드"
        body={
          <IconInputField
            wrapClassName="tool-search-input mb-6"
            placeholder="검색어를 입력하세요."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        }
        footer={
          <ToolFixedButtonSection
            descriptionText="이미지를 드래그해 교체할 수 있습니다."
            descriptionClassName="text-gray-300"
            buttonText="업로드"
            onButtonClick={openFilePicker}
            isLoading={isPending}
          />
        }
        isLoading={isLoading}
        isEmpty={assets.length === 0 && uploadingCount === 0}
        emptyTexts={
          searchParam
            ? ['검색 결과가 없습니다.']
            : ['아직 추가된 이미지가 없습니다.', '이미지를 업로드하거나 AI로 생성해보세요.']
        }
        infiniteScroll={{ hasNextPage, isFetchingNextPage, fetchNextPage }}
      >
        <AssetGrid
          assets={assets}
          total={total}
          uploadingCount={uploadingCount}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          onImageClick={handleImageClick}
          onDownload={() => download(assets, selectedIds)}
          isDownloading={isDownloading}
          onDelete={deleteSelected}
          isDeleting={isDeleting}
        />
      </ToolSectionLayout>
    </>
  );
};

export default FileTool;

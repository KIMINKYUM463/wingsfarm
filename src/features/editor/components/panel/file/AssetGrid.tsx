'use client';

import IconButton from '@/shared/ui/Button/IconButton';
import CheckableImage from '@/features/editor/components/panel/file/CheckableImage';
import Spinner from '@/shared/ui/Spinner/Spinner';
import { useDialog } from '@/shared/ui/Dialog/useDialog';
import type { Asset } from '@/features/assets';

interface AssetGridProps {
  assets: Asset[];
  total: number;
  showHeader?: boolean;
  /** 업로드 중인 파일 개수 */
  uploadingCount?: number;
  /** 그리드 첫 칸에 렌더링할 요소 (예: 추가 버튼) */
  firstChild?: React.ReactNode;
  /** 선택 모드: 'single' (단일), 'multiple' (다중, 기본값) */
  selectionMode?: 'single' | 'multiple';
  /** 선택된 asset ID 목록 */
  selectedIds?: string[];
  /** 선택 변경 콜백 */
  onSelectionChange?: (ids: string[]) => void;
  /** 이미지 클릭 핸들러 (체크박스 영역 제외) */
  onImageClick?: (assetId: string, imageUrl: string) => void;
  /** 삭제 핸들러 (선택된 항목이 있을 때만 활성화) */
  onDelete?: () => void;
  /** 삭제 중 로딩 상태 */
  isDeleting?: boolean;
  /** 다운로드 핸들러 (선택된 항목이 있을 때만 활성화) */
  onDownload?: () => void;
  /** 다운로드 중 로딩 상태 */
  isDownloading?: boolean;
}

const AssetGrid = ({
  assets,
  total,
  showHeader = true,
  uploadingCount = 0,
  firstChild,
  selectionMode = 'multiple',
  selectedIds = [],
  onSelectionChange,
  onImageClick,
  onDelete,
  isDeleting = false,
  onDownload,
  isDownloading = false,
}: AssetGridProps) => {
  const { openConfirm } = useDialog();
  const hasSelection = selectedIds.length > 0;

  const handleToggle = (id: string, nextSelected: boolean) => {
    if (!onSelectionChange) return;

    if (selectionMode === 'single') {
      onSelectionChange(nextSelected ? [id] : []);
      return;
    }

    const newIds = nextSelected
      ? [...selectedIds, id]
      : selectedIds.filter((i) => i !== id);
    onSelectionChange(newIds);
  };

  const handleDelete = async () => {
    if (!onDelete || isDeleting) return;
    const confirmed = await openConfirm({
      title: '파일 삭제',
      description: `${selectedIds.length}개 항목을 삭제하시겠어요?`,
    });
    if (confirmed) {
      onDelete();
    }
  };

  return (
    <div>
      {showHeader && (
        <div className="flex-center-between mb-5">
          <p className="title-1">
            파일 <span className="text-gray-300">({total})</span>
          </p>
          {hasSelection && (
            <div className="flex gap-0.5">
              <IconButton
                type="button"
                className="btn-icon-minimal"
                iconHeight={18}
                iconWidth={18}
                iconColor="var(--color-gray-500)"
                icon="vertical_align_bottom"
                onClick={onDownload}
                disabled={isDownloading}
              />
              <IconButton
                type="button"
                className="btn-icon-minimal"
                iconHeight={18}
                iconWidth={18}
                iconColor="var(--color-gray-500)"
                icon="delete"
                onClick={handleDelete}
                disabled={isDeleting}
              />
            </div>
          )}
        </div>
      )}
      <div className="grid grid-cols-[repeat(3,6.25rem)] justify-between gap-y-2.75">
        {/* 첫 번째 자식 (선택적) */}
        {firstChild}

        {/* 업로드 중일 때 로딩 박스 */}
        {Array.from({ length: uploadingCount }).map((_, i) => (
          <div
            key={`loading-${i}`}
            className="flex-center aspect-square rounded-lg border border-gray-100 bg-white"
          >
            <Spinner size={24} />
          </div>
        ))}

        {/* 업로드된 이미지들 (URL이 있는 asset만 렌더링) */}
        {assets.map((asset) => {
          const src = asset.thumbnailUrl ?? asset.signedUrl;
          if (!src) return null;

          return (
            <CheckableImage
              key={asset.id}
              id={asset.id}
              src={src}
              originalSrc={asset.signedUrl ?? src}
              fileName={asset.fileName}
              createdAt={asset.createdAt}
              fileSizeBytes={asset.fileSizeBytes}
              width={asset.width}
              height={asset.height}
              isAiImage={asset.isAiImage}
              selected={selectedIds.includes(asset.id)}
              hasAnySelection={hasSelection}
              onToggle={handleToggle}
              onImageClick={onImageClick ? () => onImageClick(asset.id, asset.signedUrl ?? src) : undefined}
              showCheckbox={selectionMode !== 'single'}
            />
          );
        })}
      </div>
    </div>
  );
};

export default AssetGrid;

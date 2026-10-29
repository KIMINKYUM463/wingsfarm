/**
 * 자산 다운로드 훅
 */

import { useState } from 'react';
import { downloadMultipleImages } from '@/shared/lib/download';
import { showToast } from '@/utils/toast';
import type { Asset } from '@/features/assets/types';

export const useDownloadAssets = () => {
  const [isDownloading, setIsDownloading] = useState(false);

  const download = async (assets: Asset[], selectedIds: string[]) => {
    if (selectedIds.length === 0) return;

    setIsDownloading(true);
    try {
      const selectedAssets = assets.filter(
        (asset) => selectedIds.includes(asset.id) && asset.signedUrl
      );
      const imagesToDownload = selectedAssets.map((asset) => ({
        url: asset.signedUrl!,
        filename: asset.fileName,
      }));

      await downloadMultipleImages(imagesToDownload);
    } catch (error) {
      console.error('Failed to download images:', error);
      showToast.error('다운로드에 실패했습니다');
    } finally {
      setIsDownloading(false);
    }
  };

  return { download, isDownloading };
};

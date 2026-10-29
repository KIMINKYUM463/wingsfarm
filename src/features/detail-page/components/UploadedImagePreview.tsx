'use client';

import Image from 'next/image';
import CloseButton from '@/shared/ui/Button/CloseButton';
import Spinner from '@/shared/ui/Spinner/Spinner';
import { UploadedImageInfo } from '../hooks/useImageUpload';

interface UploadedImagePreviewProps {
  images: UploadedImageInfo[];
  onRemove?: (fileKey: string) => void;
  isUploading?: boolean;
}

const UploadedImagePreview = ({ images, onRemove, isUploading }: UploadedImagePreviewProps) => {
  const hasContent = images.length > 0 || isUploading;

  if (!hasContent) return null;

  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-[0.7813rem]">
        {/* 업로드 중일 때 로딩 스피너 표시 */}
        {isUploading && (
          <div className="relative flex h-27 w-27 items-center justify-center overflow-hidden rounded-lg border border-gray-100 bg-white">
            <Spinner size={24} />
          </div>
        )}

        {/* 업로드된 이미지 미리보기 */}
        {images.map((image) => (
          <div
            key={image.fileKey}
            className="relative h-27 w-27 overflow-hidden rounded-lg border border-gray-100 bg-white"
          >
            <Image
              src={image.previewUrl}
              alt="업로드된 이미지"
              fill
              unoptimized
              className="object-cover"
            />
            <CloseButton
              variant="solid"
              onClick={() => onRemove?.(image.fileKey)}
              iconSize={18}
              className="top-1.5 right-1.5"
              ariaLabel="이미지 삭제"
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default UploadedImagePreview;

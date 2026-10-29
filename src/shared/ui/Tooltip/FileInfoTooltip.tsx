'use client';

import PositionedTooltip, { TooltipPosition } from './PositionedTooltip';
import { formatDateTime } from '@/utils/format';

interface FileInfoTooltipProps {
  position: TooltipPosition;
  fileName: string;
  width?: number;
  height?: number;
  fileSizeBytes?: number;
  createdAt?: string;
}

/** bytes를 KB/MB 단위로 변환 */
const formatFileSize = (bytes?: number): string => {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const FileInfoTooltip = ({
  position,
  fileName,
  width,
  height,
  fileSizeBytes,
  createdAt,
}: FileInfoTooltipProps) => {
  return (
    <PositionedTooltip position={position} className="w-68 p-4">
      <p className="title-1-bold truncate">{fileName}</p>
      <hr className="border-gray-700 my-4" />
      <div className="space-y-2 text-gray-300">
        {width && height && (
          <p>
            파일 정보: {width}px × {height}px, {formatFileSize(fileSizeBytes)}
          </p>
        )}
        <p>업로드 날짜: {createdAt ? formatDateTime(createdAt) : '-'}</p>
      </div>
    </PositionedTooltip>
  );
};

export default FileInfoTooltip;

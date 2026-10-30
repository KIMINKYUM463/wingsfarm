import React from 'react';

interface PathPreviewProps {
  /** 100×100 좌표의 SVG path */
  data: string;
  fill?: string;
  size?: number;
}

/** path 도형·아이콘 미리보기 — 수백 개를 그려도 가볍도록 Konva 대신 SVG로 그린다 */
const PathPreview: React.FC<PathPreviewProps> = ({ data, fill = '#2B2B2E', size = 74 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
    <path d={data} fill={fill} />
  </svg>
);

export default React.memo(PathPreview);

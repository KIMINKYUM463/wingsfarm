'use client';

import { memo } from 'react';
import type { PreviewNode } from '../api';

/**
 * 섹션 미리보기 — 서버가 만든 레이아웃(Konva 프레임 JSON)을 SVG로 그린다.
 * 문구는 foreignObject로 그려 실제와 같은 어절 줄바꿈을 보여 준다.
 * 사진 칸은 "내 사진" 컷이면 그 사진을, "AI 생성" 컷이면 회색 칸 + AI 표시.
 */
function SectionPreview({ frame, cutImage, width = 200 }: { frame: PreviewNode; cutImage: (cutId: string) => string | null; width?: number }) {
  const w = Number(frame.width) || 860;
  const h = Number(frame.height) || 600;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={width} height={(width * h) / w} className="block rounded-md border border-gray-100" role="img" aria-label="섹션 미리보기">
      <rect width={w} height={h} fill={frame.fill ?? '#fff'} />
      {frame.children?.map((node) => <PreviewElement key={node.id} node={node} cutImage={cutImage} />)}
    </svg>
  );
}

function PreviewElement({ node, cutImage }: { node: PreviewNode; cutImage: (cutId: string) => string | null }) {
  const { x = 0, y = 0, width = 0, height = 0 } = node;
  if (node.type === 'text') {
    return (
      <foreignObject x={x} y={y} width={width} height={height}>
        <div
          style={{
            fontSize: node.fontSize,
            fontWeight: node.fontWeight,
            lineHeight: node.lineHeight,
            textAlign: (node.align as 'left' | 'center' | 'right') ?? 'left',
            color: node.fill,
            wordBreak: 'keep-all',
            whiteSpace: 'pre-wrap',
            fontFamily: 'Pretendard, sans-serif',
          }}
        >
          {node.text}
        </div>
      </foreignObject>
    );
  }
  if (node.name === '_image') {
    const src = node.cutId ? cutImage(node.cutId) : null;
    const clipId = `clip-${node.id}`;
    return (
      <g>
        <clipPath id={clipId}>
          <rect x={x} y={y} width={width} height={height} rx={node.cornerRadius} />
        </clipPath>
        {src ? (
          <image href={src} x={x} y={y} width={width} height={height} preserveAspectRatio="xMidYMid slice" clipPath={`url(#${clipId})`} />
        ) : (
          <>
            <rect x={x} y={y} width={width} height={height} rx={node.cornerRadius} fill="#D9DEE5" />
            <text x={x + width / 2} y={y + height / 2} textAnchor="middle" dominantBaseline="middle" fontSize={Math.min(64, height / 4)} fontWeight={700} fill="#8A94A3">
              ✦ AI
            </text>
          </>
        )}
      </g>
    );
  }
  return <rect x={x} y={y} width={width} height={height} rx={node.cornerRadius} fill={node.fill} />;
}

export default memo(SectionPreview);

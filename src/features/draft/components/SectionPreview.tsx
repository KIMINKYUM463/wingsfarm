'use client';

import { memo, useEffect } from 'react';
import { loadFont } from '@/features/editor/lib/font-loader';
import type { PreviewNode } from '../api';

/**
 * 섹션 미리보기 — 서버가 만든 레이아웃(Konva 프레임 JSON)을 SVG로 그린다.
 * 문구는 foreignObject로 그려 실제와 같은 어절 줄바꿈을 보여 준다.
 * 사진 칸은 "내 사진" 컷이면 그 사진을, "AI 생성" 컷이면 회색 칸 + AI 표시.
 */
/** 컷 미리보기: 올린 사진 / AI가 만들 자리 / 빈 자리 */
export type CutPreview = { src: string } | 'ai' | 'blank';

function SectionPreview({ frame, cutImage, width = 200 }: { frame: PreviewNode; cutImage: (cutId: string) => CutPreview; width?: number }) {
  const w = Number(frame.width) || 860;
  const h = Number(frame.height) || 600;
  useWebFonts(frame);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={width} height={(width * h) / w} className="block rounded-md border border-gray-100" role="img" aria-label="섹션 미리보기">
      <rect width={w} height={h} fill={frame.fill ?? '#fff'} />
      {frame.children?.map((node) => <PreviewElement key={node.id} node={node} cutImage={cutImage} />)}
    </svg>
  );
}

/** 디자인 스타일이 쓰는 웹폰트(명조·세리프 등)를 불러온다 — 다 불러오면 브라우저가 알아서 다시 그린다 */
function useWebFonts(frame: PreviewNode) {
  const fonts = [
    ...new Set(
      (frame.children ?? [])
        .filter((n) => n.type === 'text' && n.fontFamily && n.fontFamily !== 'Pretendard')
        .map((n) => `${n.fontFamily}|${n.fontWeight ?? 400}`),
    ),
  ].join(',');
  useEffect(() => {
    if (!fonts) return;
    for (const key of fonts.split(',')) {
      const [family, weight] = key.split('|');
      void loadFont(family, weight).catch(() => undefined);
    }
  }, [fonts]);
}

function PreviewElement({ node, cutImage }: { node: PreviewNode; cutImage: (cutId: string) => CutPreview }) {
  const { x = 0, y = 0, width = 0, height = 0 } = node;
  if (node.type === 'text') {
    return (
      <foreignObject x={x} y={y} width={width} height={height}>
        <div
          style={{
            fontSize: node.fontSize,
            fontWeight: node.fontWeight,
            lineHeight: node.lineHeight,
            letterSpacing: node.letterSpacing,
            textAlign: (node.align as 'left' | 'center' | 'right') ?? 'left',
            color: node.fill,
            wordBreak: 'keep-all',
            whiteSpace: 'pre-wrap',
            fontFamily: `'${node.fontFamily ?? 'Pretendard'}', Pretendard, sans-serif`,
          }}
        >
          {node.text}
        </div>
      </foreignObject>
    );
  }
  if (node.name === '_image') {
    const view = node.cutId ? cutImage(node.cutId) : 'ai';
    const clipId = `clip-${node.id}`;
    const label = (text: string, fill: string) => (
      <text x={x + width / 2} y={y + height / 2} textAnchor="middle" dominantBaseline="middle" fontSize={Math.min(64, height / 4)} fontWeight={700} fill={fill}>
        {text}
      </text>
    );
    return (
      <g>
        <clipPath id={clipId}>
          <rect x={x} y={y} width={width} height={height} rx={node.cornerRadius} />
        </clipPath>
        {typeof view === 'object' ? (
          <image href={view.src} x={x} y={y} width={width} height={height} preserveAspectRatio="xMidYMid slice" clipPath={`url(#${clipId})`} />
        ) : view === 'blank' ? (
          <>
            <rect x={x} y={y} width={width} height={height} rx={node.cornerRadius} fill="#F3F4F6" stroke="#9CA3AF" strokeWidth={6} strokeDasharray="24 16" />
            {label('사진 자리', '#9CA3AF')}
          </>
        ) : (
          <>
            <rect x={x} y={y} width={width} height={height} rx={node.cornerRadius} fill="#D9DEE5" />
            {label('✦ AI', '#8A94A3')}
          </>
        )}
      </g>
    );
  }
  return (
    <rect
      x={x}
      y={y}
      width={width}
      height={height}
      rx={node.cornerRadius}
      fill={node.fill}
      stroke={node.stroke}
      strokeWidth={node.stroke ? node.strokeWidth : undefined}
      opacity={node.opacity}
    />
  );
}

export default memo(SectionPreview);

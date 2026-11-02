import '../../testing/resolveHook.ts';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { FrameNode } from './tree.ts';

const { renderFrameSvg } = await import('./svgRender.ts');

const frame = (children: FrameNode[]): FrameNode => ({ type: 'frame', id: 'f', width: 860, height: 600, fill: '#fff', children });

describe('SVG 썸네일', () => {
  it('모서리마다 반지름이 다른 사각형은 경로로 그린다', () => {
    const svg = renderFrameSvg(frame([{ type: 'rect', id: 'a', x: 10, y: 10, width: 200, height: 100, fill: '#000', cornerRadius: [40, 10, 40, 10] }]));
    assert.match(svg, /<path [^>]*d="M40 0H190A10 10/);
    assert.doesNotMatch(svg, /<rect [^>]*rx="40"/);
  });

  it('그림자·세로 그라데이션을 그린다', () => {
    const svg = renderFrameSvg(
      frame([
        { type: 'rect', id: 'a', x: 0, y: 0, width: 100, height: 100, fill: '#fff', shadowEnabled: true, shadowColor: '#000', shadowBlur: 0, shadowOffsetX: 8, shadowOffsetY: 8, shadowOpacity: 1 },
        {
          type: 'rect',
          id: 'b',
          x: 0,
          y: 0,
          width: 100,
          height: 300,
          fill: '#000',
          fillPriority: 'linear-gradient',
          fillLinearGradientStartPoint: { x: 0, y: 0 },
          fillLinearGradientEndPoint: { x: 0, y: 300 },
          fillLinearGradientColorStops: [0, 'rgba(0, 0, 0, 0.1)', 1, 'rgba(0, 0, 0, 0.7)'],
        },
      ]),
    );
    assert.match(svg, /<feDropShadow dx="8" dy="8" stdDeviation="0"/);
    assert.match(svg, /<linearGradient [^>]*y2="300"/);
  });

  it('경로 도형(말풍선·쿠폰 등)을 그린다', () => {
    const svg = renderFrameSvg(frame([{ type: 'path', id: 'a', x: 60, y: 40, width: 20, height: 20, data: 'M0 0H20V20Z', fill: '#f00' }]));
    assert.match(svg, /<path transform="translate\(60 40\)" d="M0 0H20V20Z" fill="#f00"/);
  });
});

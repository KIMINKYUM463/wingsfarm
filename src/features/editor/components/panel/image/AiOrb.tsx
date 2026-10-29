'use client';

import clsx from 'clsx';
import type { ReactNode } from 'react';
import { SparkleStars } from './SparkleStars';

const ORB_BASE = { width: '120px', height: '120px', marginLeft: '-60px', marginTop: '-60px' } as const;

/** AI 작업 중 그래픽: 검은 바탕에서 회전·펄스하는 그라데이션 구슬 두 개 + 반짝이는 별 (AI 이미지 생성·기획 초안 공용) */
export function AiOrb({ className, children }: { className?: string; children?: ReactNode }) {
  return (
    <div className={clsx('relative overflow-hidden bg-black', className)}>
      <div
        className="absolute top-1/2 left-1/2"
        style={{
          ...ORB_BASE,
          background: 'radial-gradient(ellipse at 25% 35%, #FF1493 0%, #FF69B4 15%, #9370DB 35%, #8A2BE2 55%, #FFD700 75%, #FF6B35 100%)',
          filter: 'blur(60px)',
          animation: 'spin-orb 2s linear infinite, pulse-orb 3.5s ease-in-out infinite',
        }}
      />
      <div
        className="absolute top-1/2 left-1/2"
        style={{
          ...ORB_BASE,
          opacity: 0.7,
          background: 'radial-gradient(circle at 65% 60%, #FF00FF 0%, #9370DB 40%, #FFD700 70%, transparent 100%)',
          filter: 'blur(70px)',
          animation: 'spin-orb-reverse 2.5s linear infinite, pulse-orb-alt 4s ease-in-out infinite',
        }}
      />
      <SparkleStars />
      {children}
    </div>
  );
}

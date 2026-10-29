'use client';

import React from 'react';
import Spinner from '@/shared/ui/Spinner/Spinner';

interface LoadingOverlayProps {
  /** 로딩 메시지 (선택) */
  message?: string;
}

/**
 * LoadingOverlay - 전체 화면 로딩 오버레이
 * 비동기 작업 중 전체 화면을 흐리게 하고 로딩 스피너를 표시
 * Figma 디자인: 흰색 반투명 배경 + 포인트 컬러 스피너
 *
 * ## 사용 예시
 * ```tsx
 * {isPending && <LoadingOverlay message="생성 중..." />}
 * ```
 */
const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ message }) => {
  return (
    <div className="flex-center fixed inset-0 z-9999 flex-col gap-3 bg-black/50">
      <Spinner size={29} className="text-white" />
      {message && <p className="p text-white">{message}</p>}
    </div>
  );
};

export default LoadingOverlay;

'use client';

import { useLoadingStore } from './useLoadingStore';
import LoadingOverlay from './LoadingOverlay';

/**
 * LoadingProvider - 전역 로딩 오버레이 렌더러
 * - 루트 레이아웃에 배치
 * - useLoadingStore와 함께 사용
 *
 * ## 사용 방법
 * 1. 루트 레이아웃에 <LoadingProvider /> 추가
 * 2. 어디서든 useLoadingStore()로 show/hide 호출
 *
 * ```tsx
 * const { show, hide } = useLoadingStore();
 * show('생성 중...');
 * await someAsyncOperation();
 * hide();
 * ```
 */
const LoadingProvider = () => {
  const { isLoading, message } = useLoadingStore();

  if (!isLoading) return null;

  return <LoadingOverlay message={message} />;
};

export default LoadingProvider;

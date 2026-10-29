/**
 * 이미지 관련 유틸리티
 */

/** 이미지 크기 캐시 (동일 URL 재측정 방지) */
const imageSizeCache = new Map<string, { width: number; height: number }>();

/**
 * 이미지 원본 크기 측정 (캐싱 적용)
 *
 * - 브라우저 캐시된 이미지는 즉시 반환
 * - 동일 URL은 캐시에서 반환 (재측정 방지)
 * - decode() 사용으로 메인 스레드 블로킹 최소화
 */
export const loadImageSize = async (url: string): Promise<{ width: number; height: number }> => {
  // 캐시 히트
  const cached = imageSizeCache.get(url);
  if (cached) return cached;

  const img = new Image();
  img.src = url;

  // decode()로 이미지 디코딩 완료까지 대기 (메인 스레드 블로킹 최소화)
  await img.decode();

  const size = { width: img.naturalWidth, height: img.naturalHeight };
  imageSizeCache.set(url, size);

  return size;
};

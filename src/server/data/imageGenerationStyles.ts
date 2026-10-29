/**
 * 이미지 생성 스타일 API 서비스 (서버 전용)
 */

import 'server-only';
import { IMAGE_STYLE_MAJORS } from '@/server/lever/catalog/styles';
import type { ImageGenerationStylesResponseData } from '@/features/detail-page/types';

/**
 * 이미지 생성 스타일 목록 조회
 * 계층 구조: majors → middles → styles
 */
export async function getImageGenerationStyles(): Promise<ImageGenerationStylesResponseData> {
  return { majors: IMAGE_STYLE_MAJORS } as ImageGenerationStylesResponseData;
}

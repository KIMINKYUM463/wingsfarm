/**
 * 파일 다운로드 유틸리티
 */

import { CustomError } from './CustomError';
import httpClient from './httpClient';

/**
 * 단일 이미지 다운로드
 *
 * @param url - 다운로드할 이미지 URL (signedUrl)
 * @param filename - 저장할 파일명
 */
export const downloadImage = async (url: string, filename: string): Promise<void> => {
  // httpClient는 이미 CustomError를 던지므로 별도 try-catch 불필요
  const blob = await httpClient.get<Blob>('', {
    baseURL: url,
    responseType: 'blob',
  });

  // DOM API 에러만 래핑
  try {
    const blobUrl = window.URL.createObjectURL(blob);

    // 임시 <a> 요소를 생성하여 다운로드 트리거
    // 이는 브라우저 다운로드 API의 표준 패턴입니다
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // 메모리 정리
    window.URL.revokeObjectURL(blobUrl);
  } catch (error) {
    throw new CustomError(500, `파일 저장 중 오류 발생: ${filename}`);
  }
};

/**
 * 여러 이미지 일괄 다운로드
 *
 * @param images - 다운로드할 이미지 배열 { url: string, filename: string }[]
 */
export const downloadMultipleImages = async (
  images: Array<{ url: string; filename: string }>,
): Promise<void> => {
  if (images.length === 0) {
    throw new CustomError(400, '다운로드할 이미지를 선택해주세요');
  }

  // downloadImage가 이미 CustomError를 던지므로 별도 래핑 불필요
  // 순차적으로 다운로드 (동시 다운로드 시 브라우저 제한 방지)
  for (const image of images) {
    await downloadImage(image.url, image.filename);
    // 다운로드 간 짧은 지연 (브라우저 팝업 차단 방지)
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
};

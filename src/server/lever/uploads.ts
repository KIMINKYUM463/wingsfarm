import 'server-only';
import type { ImageType, PresignedUrlRequest, PresignedUrlResponseData } from '@/features/detail-page/types';
import { badRequest } from './http';
import { safeExt, signedUploadUrl } from './storage';
import { newId } from './store';

const IMAGE_TYPES: ImageType[] = ['product', 'reference'];
const MAX_FILES = 10;

/** POST /projects/upload/{product|reference}/presigned-urls — 상품·참고 이미지 업로드 URL 발급 */
export async function createPresignedUrls(
  imageType: string,
  request: PresignedUrlRequest,
): Promise<PresignedUrlResponseData> {
  if (!IMAGE_TYPES.includes(imageType as ImageType)) throw badRequest('지원하지 않는 이미지 종류입니다.');
  const files = request?.files ?? [];
  if (!files.length) throw badRequest('업로드할 파일이 없습니다.');
  if (files.length > MAX_FILES) throw badRequest(`한 번에 최대 ${MAX_FILES}개까지 업로드할 수 있습니다.`);

  const uploadUrls = await Promise.all(
    files.map(async (file) => {
      const path = `uploads/${imageType}/${newId()}.${safeExt(file.fileName, file.contentType)}`;
      return { fileKey: file.fileKey, path, ...(await signedUploadUrl(path)) };
    }),
  );
  return { uploadUrls };
}

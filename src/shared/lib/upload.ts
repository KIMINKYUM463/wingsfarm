import httpClient from './httpClient';

/**
 * Signed URL로 파일을 업로드하는 공통 유틸리티
 *
 * @param file - 업로드할 파일
 * @param signedUrl - Supabase Storage signed URL
 */
export const uploadFileToSignedUrl = async (file: File, signedUrl: string): Promise<void> => {
  await httpClient.put('', file, {
    baseURL: signedUrl,
    timeout: 60000, // 60초
  });
};

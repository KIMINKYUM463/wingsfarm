/**
 * 파일 변환 유틸리티
 */

/**
 * dataURL을 File 객체로 변환
 *
 * @param dataURL - base64 인코딩된 dataURL
 * @param filename - 생성할 파일명
 * @returns File 객체
 */
export const dataURLtoFile = (dataURL: string, filename: string): File => {
  const arr = dataURL.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/webp';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
};

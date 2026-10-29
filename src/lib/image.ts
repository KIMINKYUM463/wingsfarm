/**
 * 긴 변이 maxSide를 넘으면 비율을 유지해 줄이고 JPEG data URL로 변환한다.
 * 긴 휴대폰 캡처도 글자가 읽히도록 기본 2000px로 둔다.
 */
export async function toResizedDataUrl(file: Blob, maxSide = 2000, quality = 0.9): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", quality);
}

export const dataUrlExt = (dataUrl: string) => (dataUrl.startsWith("data:image/png") ? "png" : "jpg");

export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

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

/** 이미 만든 data URL(예: AI 결과 PNG)을 작은 JPEG로 다시 압축 */
export async function compressDataUrl(dataUrl: string, maxSide: number, quality = 0.88) {
  const blob = await (await fetch(dataUrl)).blob();
  return toResizedDataUrl(blob, maxSide, quality);
}

/**
 * 세로로 긴 캡처(상세페이지 전체 화면 등)를 폭 width로 맞춘 뒤 위에서부터 잘라 JPEG 조각으로 만든다.
 * 조각이 maxTiles를 넘지 않도록 조각 높이를 늘린다. (긴 변만 줄이면 글자가 뭉개지기 때문)
 */
export async function splitTallImage(file: Blob, { width = 900, tileHeight = 1300, maxTiles = 4, quality = 0.8 } = {}) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, width / bitmap.width);
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const step = Math.max(tileHeight, Math.ceil(h / maxTiles));
  const tiles: string[] = [];
  for (let y = 0; y < h; y += step) {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = Math.min(step, h - y);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, y / scale, bitmap.width, canvas.height / scale, 0, 0, w, canvas.height);
    tiles.push(canvas.toDataURL("image/jpeg", quality));
  }
  bitmap.close();
  return tiles;
}

export const dataUrlExt = (dataUrl: string) => (dataUrl.startsWith("data:image/png") ? "png" : "jpg");

export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

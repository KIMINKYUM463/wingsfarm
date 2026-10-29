import { toCanvas } from "html-to-image";
import { groupByHeight } from "@/lib/detailPage";

const JPEG_QUALITY = 0.92;

/**
 * 섹션 DOM을 실제 크기(860px, 배율 1)로 그린다. 폰트는 시스템 글꼴이라 내장 생략.
 * backgroundColor 옵션은 섹션 자체 배경까지 덮어쓰므로 쓰지 않는다 (섹션마다 배경색이 있음).
 */
export const captureSection = (node: HTMLElement) => toCanvas(node, { pixelRatio: 1, skipFonts: true });

export const canvasToJpeg = (canvas: HTMLCanvasElement) => canvas.toDataURL("image/jpeg", JPEG_QUALITY);

/** 섹션 캔버스들을 세로로 이어 붙여 긴 JPEG(너무 길면 여러 장)로 만든다 */
export function stitchCanvases(canvases: HTMLCanvasElement[]) {
  return groupByHeight(canvases.map((c) => c.height)).map((group) => {
    const parts = group.map((i) => canvases[i]);
    const out = document.createElement("canvas");
    out.width = Math.max(...parts.map((c) => c.width));
    out.height = parts.reduce((sum, c) => sum + c.height, 0);
    const ctx = out.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, out.width, out.height);
    let y = 0;
    for (const c of parts) {
      ctx.drawImage(c, 0, y);
      y += c.height;
    }
    return canvasToJpeg(out);
  });
}

/** 동시에 size개씩 처리 (AI 사진 생성 등 서버 부담·한도 완화) */
export async function runWithConcurrency<T>(items: T[], size: number, task: (item: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: Math.min(size, queue.length) }, async () => {
      while (queue.length) await task(queue.shift()!);
    }),
  );
}

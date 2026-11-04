/**
 * 자막·태그 PNG 생성
 *
 * 배포용 ffmpeg-static(Linux)에는 drawtext(libfreetype)가 없어
 * 글자를 미리 그림으로 만든 뒤 overlay로 올린다. (로컬 Windows 빌드에는 drawtext가 있음)
 */
import 'server-only';
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const FONT_FAMILY = 'WingsCaption';
const FONT_PATH = path.join(process.cwd(), 'assets', 'fonts', 'Pretendard-Bold.otf');

let fontReady: Promise<boolean> | null = null;

async function ensureFont() {
  fontReady ??= (async () => {
    try {
      const data = await readFile(FONT_PATH);
      GlobalFonts.register(data, FONT_FAMILY);
      return true;
    } catch (err) {
      console.error('[lever] caption font register failed', err);
      return false;
    }
  })();
  return fontReady;
}

/** 하단 자막 박스 PNG (반투명 검정 배경 + 흰 글씨) */
export async function renderCaptionPng(text: string, videoWidth: number): Promise<Buffer | null> {
  if (!(await ensureFont()) || !text.trim()) return null;
  const fontSize = Math.min(Math.round(videoWidth * 0.062), Math.floor((videoWidth * 0.82) / Math.max(1, Array.from(text).length)));
  const padX = Math.round(fontSize * 0.55);
  const padY = Math.round(fontSize * 0.45);
  const canvas = createCanvas(8, 8);
  const measure = canvas.getContext('2d');
  measure.font = `700 ${fontSize}px "${FONT_FAMILY}"`;
  const textW = Math.ceil(measure.measureText(text).width);
  const textH = Math.ceil(fontSize * 1.25);
  const width = textW + padX * 2;
  const height = textH + padY * 2;
  const out = createCanvas(width, height);
  const ctx = out.getContext('2d');
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, 0, width, height);
  ctx.font = `700 ${fontSize}px "${FONT_FAMILY}"`;
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(text, padX, height / 2);
  return out.toBuffer('image/png');
}

/** 왼쪽 위 상품명 태그 PNG (포인트 색 배경) */
export async function renderTagPng(text: string, videoWidth: number): Promise<Buffer | null> {
  if (!(await ensureFont()) || !text.trim()) return null;
  const fontSize = Math.round(videoWidth * 0.03);
  const padX = Math.round(fontSize * 0.7);
  const padY = Math.round(fontSize * 0.55);
  const canvas = createCanvas(8, 8);
  const measure = canvas.getContext('2d');
  measure.font = `700 ${fontSize}px "${FONT_FAMILY}"`;
  const textW = Math.ceil(measure.measureText(text).width);
  const textH = Math.ceil(fontSize * 1.2);
  const width = textW + padX * 2;
  const height = textH + padY * 2;
  const out = createCanvas(width, height);
  const ctx = out.getContext('2d');
  ctx.fillStyle = '#5DADEC';
  ctx.fillRect(0, 0, width, height);
  ctx.font = `700 ${fontSize}px "${FONT_FAMILY}"`;
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, padX, height / 2);
  return out.toBuffer('image/png');
}

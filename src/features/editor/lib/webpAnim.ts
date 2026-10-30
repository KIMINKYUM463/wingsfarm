/**
 * 한 장짜리 WebP 파일 여러 개 → 움직이는 WebP 하나 (RIFF 컨테이너 직접 조립)
 * 브라우저 canvas.toBlob('image/webp')는 정지 이미지만 만들기 때문에, 각 장의 이미지 데이터만 꺼내 ANMF 프레임으로 묶는다.
 */

export interface WebpFrame {
  file: Uint8Array;
  /** 이 장을 보여 줄 시간 (ms) */
  duration: number;
}

interface ParsedWebp {
  width: number;
  height: number;
  alpha: boolean;
  /** ALPH·VP8·VP8L 청크 (헤더 포함) — ANMF 안에 그대로 넣는다 */
  imageChunks: Uint8Array;
}

const ascii = (bytes: Uint8Array, offset: number) => String.fromCharCode(...bytes.subarray(offset, offset + 4));
const u16 = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8);
const u24 = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8) | (b[o + 2] << 16);
const u32 = (b: Uint8Array, o: number) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

const le = (value: number, bytes: number) => Array.from({ length: bytes }, (_, i) => (value >>> (8 * i)) & 0xff);

const concat = (parts: Uint8Array[]): Uint8Array<ArrayBuffer> => {
  const out = new Uint8Array(parts.reduce((sum, p) => sum + p.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
};

/** 청크 = 이름(4) + 크기(4) + 내용 (+ 홀수면 0 한 바이트) */
const chunk = (id: string, payload: Uint8Array) =>
  concat([
    new Uint8Array([...Array.from(id, (c) => c.charCodeAt(0)), ...le(payload.length, 4)]),
    payload,
    new Uint8Array(payload.length % 2),
  ]);

export function parseWebp(file: Uint8Array): ParsedWebp {
  if (file.length < 20 || ascii(file, 0) !== 'RIFF' || ascii(file, 8) !== 'WEBP') throw new Error('WebP 파일이 아니에요.');
  let width = 0;
  let height = 0;
  let alpha = false;
  const imageChunks: Uint8Array[] = [];

  for (let offset = 12; offset + 8 <= file.length; ) {
    const id = ascii(file, offset);
    const size = u32(file, offset + 4);
    const payload = file.subarray(offset + 8, offset + 8 + size);
    const end = offset + 8 + size + (size % 2);
    if (id === 'VP8X') {
      alpha = (payload[0] & 0x10) !== 0;
      width = 1 + u24(payload, 4);
      height = 1 + u24(payload, 7);
    } else if (id === 'ALPH') {
      alpha = true;
      imageChunks.push(file.subarray(offset, end));
    } else if (id === 'VP8 ') {
      if (!width) {
        width = u16(payload, 6) & 0x3fff;
        height = u16(payload, 8) & 0x3fff;
      }
      imageChunks.push(file.subarray(offset, end));
    } else if (id === 'VP8L') {
      if (!width) {
        width = 1 + (((payload[2] & 0x3f) << 8) | payload[1]);
        height = 1 + (((payload[4] & 0x0f) << 10) | (payload[3] << 2) | ((payload[2] & 0xc0) >> 6));
        alpha = ((payload[4] >> 4) & 1) === 1;
      }
      imageChunks.push(file.subarray(offset, end));
    }
    offset = end;
  }
  if (!width || !height || !imageChunks.length) throw new Error('WebP 이미지 정보를 읽지 못했어요.');
  return { width, height, alpha, imageChunks: concat(imageChunks) };
}

const sameBytes = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((v, i) => v === b[i]);

/** 바로 앞 장과 똑같은 장은 하나로 합치고 보여 주는 시간만 늘린다 */
export function mergeRepeatedFrames(frames: WebpFrame[]): WebpFrame[] {
  return frames.reduce<WebpFrame[]>((merged, frame) => {
    const last = merged.at(-1);
    if (last && sameBytes(last.file, frame.file)) last.duration += frame.duration;
    else merged.push({ ...frame });
    return merged;
  }, []);
}

/** @param loop 반복 횟수 (0 = 무한) */
export function muxAnimatedWebp(frames: WebpFrame[], loop = 0): Uint8Array<ArrayBuffer> {
  const parsed = mergeRepeatedFrames(frames).map((frame) => ({ ...parseWebp(frame.file), duration: frame.duration }));
  if (!parsed.length) throw new Error('프레임이 없어요.');
  const width = Math.max(...parsed.map((p) => p.width));
  const height = Math.max(...parsed.map((p) => p.height));
  const alpha = parsed.some((p) => p.alpha);

  const vp8x = chunk('VP8X', new Uint8Array([0x02 | (alpha ? 0x10 : 0), 0, 0, 0, ...le(width - 1, 3), ...le(height - 1, 3)]));
  const anim = chunk('ANIM', new Uint8Array([0xff, 0xff, 0xff, 0xff, ...le(loop, 2)]));
  const anmf = parsed.map((p) =>
    chunk(
      'ANMF',
      concat([
        // x/2, y/2, 너비-1, 높이-1, 시간(ms), 플래그(겹쳐 그리지 않음)
        new Uint8Array([...le(0, 3), ...le(0, 3), ...le(p.width - 1, 3), ...le(p.height - 1, 3), ...le(Math.round(p.duration), 3), 0x02]),
        p.imageChunks,
      ]),
    ),
  );
  const body = concat([new Uint8Array(Array.from('WEBP', (c) => c.charCodeAt(0))), vp8x, anim, ...anmf]);
  return concat([new Uint8Array([...Array.from('RIFF', (c) => c.charCodeAt(0)), ...le(body.length, 4)]), body]);
}

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mergeRepeatedFrames, muxAnimatedWebp, parseWebp } from './webpAnim.ts';

const bytes = (text: string) => Array.from(text, (c) => c.charCodeAt(0));
const le = (v: number, n: number) => Array.from({ length: n }, (_, i) => (v >>> (8 * i)) & 0xff);
const ascii = (b: Uint8Array, o: number) => String.fromCharCode(...b.subarray(o, o + 4));
const u24 = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8) | (b[o + 2] << 16);
const u32 = (b: Uint8Array, o: number) => (u24(b, o) | (b[o + 3] << 24)) >>> 0;

/** 손실 압축(VP8) 한 장짜리 가짜 WebP — 헤더의 너비·높이만 진짜처럼 */
const fakeWebp = (width: number, height: number, seed: number) => {
  const vp8 = [seed, 0, 0, 0x9d, 0x01, 0x2a, ...le(width, 2), ...le(height, 2), seed, seed];
  const body = [...bytes('WEBP'), ...bytes('VP8 '), ...le(vp8.length, 4), ...vp8];
  return new Uint8Array([...bytes('RIFF'), ...le(body.length, 4), ...body]);
};

/** RIFF 안 청크 목록 [이름, 내용 시작, 크기] */
const chunks = (file: Uint8Array, from = 12, to = file.length) => {
  const list: [string, number, number][] = [];
  for (let o = from; o + 8 <= to; ) {
    const size = u32(file, o + 4);
    list.push([ascii(file, o), o + 8, size]);
    o += 8 + size + (size % 2);
  }
  return list;
};

describe('움직이는 WebP 조립', () => {
  it('한 장짜리 WebP의 크기를 읽는다', () => {
    const parsed = parseWebp(fakeWebp(860, 1200, 1));
    assert.deepEqual([parsed.width, parsed.height, parsed.alpha], [860, 1200, false]);
    assert.throws(() => parseWebp(new Uint8Array(30)));
  });

  it('VP8X·ANIM·ANMF 순서로 묶고 크기·시간을 적는다', () => {
    const file = muxAnimatedWebp([
      { file: fakeWebp(780, 500, 1), duration: 100 },
      { file: fakeWebp(780, 500, 2), duration: 100 },
    ]);
    assert.equal(ascii(file, 0), 'RIFF');
    assert.equal(u32(file, 4), file.length - 8);
    assert.equal(ascii(file, 8), 'WEBP');

    const list = chunks(file);
    assert.deepEqual(list.map(([id]) => id), ['VP8X', 'ANIM', 'ANMF', 'ANMF']);
    const [, vp8x] = list[0];
    assert.equal(file[vp8x] & 0x02, 0x02);
    assert.equal(u24(file, vp8x + 4) + 1, 780);
    assert.equal(u24(file, vp8x + 7) + 1, 500);

    const [, anmf, size] = list[2];
    assert.equal(u24(file, anmf + 6) + 1, 780);
    assert.equal(u24(file, anmf + 12), 100);
    assert.deepEqual(chunks(file, anmf + 16, anmf + size).map(([id]) => id), ['VP8 ']);
  });

  it('똑같은 장이 이어지면 하나로 합치고 시간을 더한다', () => {
    const a = fakeWebp(10, 10, 1);
    const b = fakeWebp(10, 10, 2);
    const frames = [
      { file: a, duration: 100 },
      { file: a, duration: 100 },
      { file: b, duration: 100 },
      { file: a, duration: 100 },
    ];
    assert.deepEqual(mergeRepeatedFrames(frames).map((f) => f.duration), [200, 100, 100]);
    assert.equal(frames[0].duration, 100);
    assert.equal(chunks(muxAnimatedWebp(frames)).filter(([id]) => id === 'ANMF').length, 3);
  });
});

/** gifenc 1.0.3 (MIT) — 쓰는 함수만 선언 */
declare module 'gifenc' {
  export type Palette = number[][];

  export interface WriteFrameOptions {
    palette?: Palette;
    /** ms */
    delay?: number;
    transparent?: boolean;
    transparentIndex?: number;
    /** -1 = 한 번, 0 = 무한 반복 */
    repeat?: number;
    /** 1 = 다음 장을 그릴 때 이 장을 지우지 않음 */
    dispose?: number;
  }

  export interface Encoder {
    writeFrame(index: Uint8Array, width: number, height: number, options?: WriteFrameOptions): void;
    finish(): void;
    bytes(): Uint8Array<ArrayBuffer>;
  }

  export function GIFEncoder(options?: { initialCapacity?: number; auto?: boolean }): Encoder;
  export function quantize(rgba: Uint8Array | Uint8ClampedArray, maxColors: number, options?: Record<string, unknown>): Palette;
  export function applyPalette(rgba: Uint8Array | Uint8ClampedArray, palette: Palette, format?: string): Uint8Array;
}

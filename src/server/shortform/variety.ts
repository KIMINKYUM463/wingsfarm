/**
 * 같은 상품·템플릿이라도 작업(job)마다 다른 영상·카메라·효과가 나오게 하는 시드 유틸.
 */
import 'server-only';
import path from 'node:path';

export function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) h = Math.imul(h ^ input.charCodeAt(i), 16777619);
  return Math.abs(h) >>> 0;
}

export function pickIndex(seed: number, length: number, salt = 0): number {
  if (length <= 0) return 0;
  return (seed + salt * 2654435761) % length;
}

/** 사진 패닝/줌 스타일 — 장면·작업마다 다른 움직임을 준다 */
export const PAN_STYLES = [
  // 살짝 확대하며 오른쪽
  (n: number) =>
    `zoompan=z='1+0.12*on/${n}':x='(iw-iw/zoom)*on/${n}':y='(ih-ih/zoom)/2':d=${n}:s=WXH:fps=FPS`,
  // 확대하며 왼쪽·위
  (n: number) =>
    `zoompan=z='1.05+0.14*on/${n}':x='(iw-iw/zoom)*(1-on/${n})':y='(ih-ih/zoom)*on/${n}*0.6':d=${n}:s=WXH:fps=FPS`,
  // 살짝 축소(풀샷으로)
  (n: number) =>
    `zoompan=z='1.18-0.1*on/${n}':x='(iw-iw/zoom)/2':y='(ih-ih/zoom)*(0.3+0.4*on/${n})':d=${n}:s=WXH:fps=FPS`,
  // 아래로 천천히
  (n: number) =>
    `zoompan=z='1.1+0.08*on/${n}':x='(iw-iw/zoom)/2':y='(ih-ih/zoom)*on/${n}':d=${n}:s=WXH:fps=FPS`,
  // 대각선
  (n: number) =>
    `zoompan=z='1.08+0.15*on/${n}':x='(iw-iw/zoom)*on/${n}':y='(ih-ih/zoom)*(1-on/${n})':d=${n}:s=WXH:fps=FPS`,
  // 가운데 고정 확대
  (n: number) =>
    `zoompan=z='1+0.16*on/${n}':x='(iw-iw/zoom)/2':y='(ih-ih/zoom)/2':d=${n}:s=WXH:fps=FPS`,
] as const;

export function panFilter(seed: number, sceneIndex: number, frames: number, w: number, h: number, fps: number) {
  const style = PAN_STYLES[pickIndex(seed, PAN_STYLES.length, sceneIndex + 1)]!;
  return style(frames)
    .replace(/WXH/g, `${w}x${h}`)
    .replace(/FPS/g, String(fps));
}

/** 부드러운 효과음 (날카로운 틱/찍 제외) */
export const SFX = {
  whoosh: ['whoosh_soft.mp3', 'whoosh_air.mp3', 'whoosh_bright.mp3'] as const,
  accent: ['swell.mp3', 'rise.mp3', 'chime_warm.mp3', 'chime_soft.mp3'] as const,
  thud: ['thud_soft.mp3', 'thud_deep.mp3'] as const,
};

export function sfxDir() {
  return path.join(process.cwd(), 'shortform', 'studio', 'data', 'sfx');
}

export function pickSfx(
  kind: keyof typeof SFX,
  seed: number,
  sceneIndex: number,
): string {
  const list = SFX[kind];
  const name = list[pickIndex(seed, list.length, sceneIndex * 3 + kind.length)]!;
  return path.join(sfxDir(), name);
}

/** 장면 역할에 맞는 효과음 종류 */
export function sfxKindForScene(kind: string, sceneIndex: number): keyof typeof SFX | null {
  if (sceneIndex === 0) return 'accent'; // 첫 장면: 부드러운 swell/chime
  const k = (kind || 'TIP').toUpperCase();
  if (k === 'HOOK') return 'accent';
  if (k === 'REVEAL' || k === 'PRICE') return 'thud';
  if (k === 'CTA') return 'accent';
  return 'whoosh'; // TIP 등 전환
}

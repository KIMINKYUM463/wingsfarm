/**
 * 템플릿 도형 경로 (SVG path data, 도형의 왼쪽 위가 0,0)
 *
 * 서버 템플릿(Konva Path 노드)·SVG 썸네일·초안 미리보기가 같은 문자열을 쓴다.
 * Konva Path와 SVG 모두 M/L/H/V/Q/C/A/Z 명령을 같은 뜻으로 해석한다.
 */
const n = (v: number) => Math.round(v * 10) / 10;

/** 모서리 반지름 4개 — Konva 순서: 왼쪽 위, 오른쪽 위, 오른쪽 아래, 왼쪽 아래 */
export type Corners = [number, number, number, number];

/** Konva cornerRadius(숫자 또는 배열) → 모서리 4개 (도형 크기를 넘지 않게) */
export function cornersOf(radius: number | number[] | undefined, width: number, height: number): Corners {
  const list = Array.isArray(radius) ? radius : [radius ?? 0];
  const max = Math.max(0, Math.min(width, height) / 2);
  const at = (i: number) => Math.min(max, Math.max(0, Number(list[i] ?? list[0]) || 0));
  return [at(0), at(1), at(2), at(3)];
}

const arc = (r: number, x: number, y: number) => (r ? `A${n(r)} ${n(r)} 0 0 1 ${n(x)} ${n(y)}` : '');

/** 모서리마다 반지름이 다른 사각형 */
export function roundedRectPath(width: number, height: number, radius: number | number[] | undefined) {
  const [tl, tr, br, bl] = cornersOf(radius, width, height);
  return (
    `M${n(tl)} 0H${n(width - tr)}${arc(tr, width, tr)}V${n(height - br)}${arc(br, width - br, height)}` +
    `H${n(bl)}${arc(bl, 0, height - bl)}V${n(tl)}${arc(tl, tl, 0)}Z`
  );
}

export interface Tail {
  /** 꼬리가 붙는 변 */
  side: 'top' | 'bottom';
  /** 꼬리 끝의 가로 위치 (도형 왼쪽 기준) */
  at: number;
  /** 꼬리 높이 */
  size: number;
}

/**
 * 말풍선: 몸통(width × bodyHeight) + 위나 아래로 삐죽 나온 꼬리
 * 경로 전체 높이는 bodyHeight + tail.size (꼬리가 위면 몸통이 tail.size만큼 아래에서 시작)
 */
export function bubblePath(width: number, bodyHeight: number, radius: number, tail: Tail) {
  const r = Math.min(radius, bodyHeight / 2, width / 2);
  const s = tail.size;
  const at = Math.min(Math.max(tail.at, r + s), width - r - s);
  const y0 = tail.side === 'top' ? s : 0;
  const y1 = y0 + bodyHeight;
  const top = tail.side === 'top' ? `H${n(at - s)}L${n(at)} 0L${n(at + s)} ${n(y0)}` : '';
  const bottom = tail.side === 'bottom' ? `H${n(at + s)}L${n(at)} ${n(y1 + s)}L${n(at - s)} ${n(y1)}` : '';
  return (
    `M${n(r)} ${n(y0)}${top}H${n(width - r)}${arc(r, width, y0 + r)}V${n(y1 - r)}${arc(r, width - r, y1)}` +
    `${bottom}H${n(r)}${arc(r, 0, y1 - r)}V${n(y0 + r)}${arc(r, r, y0)}Z`
  );
}

/** 톱니 스티커 (지름 size, 꼭짓점 points개, depth = 안쪽으로 파인 비율) */
export function burstPath(size: number, points = 16, depth = 0.1) {
  const R = size / 2;
  const steps = points * 2;
  let d = '';
  for (let i = 0; i < steps; i++) {
    const angle = -Math.PI / 2 + (i * Math.PI) / points;
    const radius = i % 2 ? R * (1 - depth) : R;
    d += `${i ? 'L' : 'M'}${n(R + radius * Math.cos(angle))} ${n(R + radius * Math.sin(angle))}`;
  }
  return `${d}Z`;
}

/** 반짝이 (오목한 네 꼭짓점 별) */
export function sparklePath(size: number) {
  const h = size / 2;
  return `M${n(h)} 0Q${n(h)} ${n(h)} ${n(size)} ${n(h)}Q${n(h)} ${n(h)} ${n(h)} ${n(size)}Q${n(h)} ${n(h)} 0 ${n(h)}Q${n(h)} ${n(h)} ${n(h)} 0Z`;
}

/** 마름모 */
/**
 * 오른쪽이 잘린 원 — 지름 2r 원에서 왼쪽 visible 폭만 남긴다 (화면 끝에 걸친 장식 원).
 * 상자: 폭 visible × 높이 2r (visible은 r~2r)
 */
export function clippedCirclePath(r: number, visible: number) {
  const v = Math.min(2 * r, Math.max(r, visible));
  const dy = Math.sqrt(Math.max(0, r * r - (v - r) * (v - r)));
  return `M${n(v)} ${n(r - dy)}A${n(r)} ${n(r)} 0 1 0 ${n(v)} ${n(r + dy)}Z`;
}

/** 채운 체크 표시 (size × size) */
export function checkPath(size: number) {
  const p = [
    [0.12, 0.53],
    [0.25, 0.4],
    [0.41, 0.56],
    [0.75, 0.22],
    [0.88, 0.35],
    [0.41, 0.82],
  ];
  return `M${p.map(([x, y]) => `${n(x * size)} ${n(y * size)}`).join('L')}Z`;
}

export const diamondPath = (size: number) => `M${n(size / 2)} 0L${n(size)} ${n(size / 2)}L${n(size / 2)} ${n(size)}L0 ${n(size / 2)}Z`;

/** 아래로 좁아지는 사다리꼴 (inset = 아래 변 양쪽이 들어온 폭) */
export const trapezoidPath = (width: number, height: number, inset: number) =>
  `M0 0H${n(width)}L${n(width - inset)} ${n(height)}H${n(inset)}Z`;

/** 위 변이 물결인 띠 (물결 높이 amp, 물결 waves번) — 전체 높이 height 안에 그린다 */
export function wavePath(width: number, height: number, amp: number, waves = 3) {
  const seg = width / waves;
  let d = `M0 ${n(amp)}`;
  for (let i = 0; i < waves; i++) {
    const x = i * seg;
    d += `Q${n(x + seg / 4)} 0 ${n(x + seg / 2)} ${n(amp)}Q${n(x + (seg * 3) / 4)} ${n(amp * 2)} ${n(x + seg)} ${n(amp)}`;
  }
  return `${d}V${n(height)}H0Z`;
}

/**
 * 손으로 그린 듯한 얼룩 (타원 둘레 점 6개를 부드럽게 잇는다)
 * 반지름을 92% 안쪽으로 잡아 곡선 손잡이가 상자 밖으로 나가지 않게 한다
 */
export function blobPath(width: number, height: number) {
  const JITTER = [1, 0.84, 0.96, 0.8, 0.98, 0.88];
  const cx = width / 2;
  const cy = height / 2;
  const pts = JITTER.map((j, i) => {
    const a = (i / JITTER.length) * Math.PI * 2;
    return [cx + Math.cos(a) * cx * 0.92 * j, cy + Math.sin(a) * cy * 0.92 * j];
  });
  const at = (i: number) => pts[(i + pts.length) % pts.length];
  let d = `M${n(pts[0][0])} ${n(pts[0][1])}`;
  for (let i = 0; i < pts.length; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${n(c1[0])} ${n(c1[1])} ${n(c2[0])} ${n(c2[1])} ${n(p2[0])} ${n(p2[1])}`;
  }
  return `${d}Z`;
}

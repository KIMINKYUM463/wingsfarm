import type { AnimationEffect, ElementAnimation } from '@/shared/types/animation';
import type { KonvaElement } from '@/shared/types/konva';

/**
 * 요소 움직임 계산 (Konva와 무관한 순수 함수 — 미리보기·GIF·WebP가 같은 값을 쓴다)
 */

export const PAGE_LENGTH = { min: 1, max: 10, default: 5 } as const;
/** GIF·WebP 초당 프레임 수 — GIF 지연 시간은 1/100초 단위라 10fps(100ms)가 정확히 맞는다 */
export const ANIMATION_FPS = 10;

const SLIDE_DISTANCE = 80;
const ZOOM_FROM = 0.6;
const BOUNCE_HEIGHT = 24;
const BLINK_MIN_OPACITY = 0.2;

export interface EffectInfo {
  id: AnimationEffect;
  label: string;
  kind: 'enter' | 'loop';
  /** 기본 길이(초) */
  duration: number;
  /** 글자 요소에만 / 숫자가 있는 글자에만 */
  needs?: 'text' | 'number';
}

export const ANIMATION_EFFECTS: readonly EffectInfo[] = [
  { id: 'fade', label: '페이드 인', kind: 'enter', duration: 0.8 },
  { id: 'slide', label: '슬라이드 인', kind: 'enter', duration: 0.8 },
  { id: 'zoom', label: '줌 인', kind: 'enter', duration: 0.8 },
  { id: 'typing', label: '타이핑', kind: 'enter', duration: 1.2, needs: 'text' },
  { id: 'countUp', label: '숫자 카운트업', kind: 'enter', duration: 1.2, needs: 'number' },
  { id: 'blink', label: '깜빡임', kind: 'loop', duration: 1 },
  { id: 'bounce', label: '바운스', kind: 'loop', duration: 0.8 },
];

export const effectInfo = (effect: AnimationEffect | undefined) => ANIMATION_EFFECTS.find((e) => e.id === effect);

/** 0.1초 단위로 반올림해 범위 안에 넣는다 */
export const clampSeconds = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Math.round((Number.isFinite(value) ? value : min) * 10) / 10));

export const pageLengthOf = (frame: { animationLength?: number }) =>
  clampSeconds(frame.animationLength ?? PAGE_LENGTH.default, PAGE_LENGTH.min, PAGE_LENGTH.max);

export const createAnimation = (effect: AnimationEffect): ElementAnimation => ({
  effect,
  delay: 0,
  duration: effectInfo(effect)?.duration ?? 1,
});

/** 시작·길이가 페이지 길이를 넘지 않게 맞춘다 */
export const normalizeAnimation = (animation: ElementAnimation, pageLength: number): ElementAnimation => ({
  effect: animation.effect,
  delay: clampSeconds(animation.delay, 0, Math.max(0, pageLength - 0.1)),
  duration: clampSeconds(animation.duration, 0.2, pageLength),
});

// ===== 글자 =====

const NUMBER = /\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g;

export const hasNumber = (text: string) => /\d/.test(text);

/** 이 요소에 쓸 수 있는 효과인지 (타이핑은 글자, 카운트업은 숫자가 있는 글자만) */
export const canUseEffect = (info: EffectInfo, element: KonvaElement) => {
  if (!info.needs) return true;
  if (element.type !== 'text') return false;
  return info.needs === 'text' || hasNumber(element.text);
};

/** 앞에서부터 reveal(0~1) 비율만큼의 글자 (한글·이모지도 한 글자씩) */
export const typedText = (text: string, reveal: number) => {
  const chars = Array.from(text);
  return chars.slice(0, Math.round(chars.length * reveal)).join('');
};

/** 글자 속 숫자를 0에서 원래 값까지 reveal 비율만큼 (쉼표·소수 자릿수 유지) */
export const countUpText = (text: string, reveal: number) =>
  text.replace(NUMBER, (match) => {
    const decimals = match.split('.')[1]?.length ?? 0;
    const value = Number(match.replace(/,/g, '')) * reveal;
    return match.includes(',')
      ? value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
      : value.toFixed(decimals);
  });

// ===== 시점별 모습 =====

export interface AnimationPose {
  /** 원래 불투명도에 곱하는 값 */
  opacity: number;
  dx: number;
  dy: number;
  /** 요소 가운데를 기준으로 한 배율 */
  scale: number;
  /** 타이핑·카운트업 진행도 (0~1) */
  reveal: number;
}

export const STILL_POSE: AnimationPose = { opacity: 1, dx: 0, dy: 0, scale: 1, reveal: 1 };

const easeOutCubic = (p: number) => 1 - (1 - p) ** 3;
const progress = (local: number, duration: number) => Math.min(1, Math.max(0, local / duration));

/** 페이지 재생 t초일 때 요소 모습 */
export function poseAt(animation: ElementAnimation, t: number): AnimationPose {
  const info = effectInfo(animation.effect);
  if (!info) return STILL_POSE;
  const local = t - animation.delay;
  const duration = Math.max(animation.duration, 0.01);

  if (info.kind === 'loop') {
    if (local < 0) return STILL_POSE;
    const phase = (local % duration) / duration;
    if (animation.effect === 'blink') {
      return { ...STILL_POSE, opacity: BLINK_MIN_OPACITY + (1 - BLINK_MIN_OPACITY) * (0.5 + 0.5 * Math.cos(2 * Math.PI * phase)) };
    }
    return { ...STILL_POSE, dy: -BOUNCE_HEIGHT * Math.sin(Math.PI * phase) };
  }

  const linear = progress(local, duration);
  const eased = easeOutCubic(linear);
  switch (animation.effect) {
    case 'fade':
      return { ...STILL_POSE, opacity: eased };
    case 'slide':
      return { ...STILL_POSE, opacity: eased, dy: SLIDE_DISTANCE * (1 - eased) };
    case 'zoom':
      return { ...STILL_POSE, opacity: eased, scale: ZOOM_FROM + (1 - ZOOM_FROM) * eased };
    case 'typing':
      return { ...STILL_POSE, reveal: linear };
    case 'countUp':
      return { ...STILL_POSE, reveal: eased };
    default:
      return STILL_POSE;
  }
}

/** 재생 길이 동안 찍을 시점들 (초) */
export const frameTimes = (pageLength: number, fps = ANIMATION_FPS) =>
  Array.from({ length: Math.max(1, Math.round(pageLength * fps)) }, (_, i) => i / fps);

// ===== 페이지 =====

/** 움직임이 들어간 요소 (그룹 안까지) */
export function collectAnimated(elements: KonvaElement[]): KonvaElement[] {
  return elements.flatMap((element) => [
    ...(element.animation && effectInfo(element.animation.effect) ? [element] : []),
    ...('children' in element && Array.isArray(element.children) ? collectAnimated(element.children) : []),
  ]);
}

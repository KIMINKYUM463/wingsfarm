/**
 * 요소 움직임 (페이지 GIF·WebP로 내보냄)
 * - enter: 페이지 재생 중 한 번 나타남 (fade·slide·zoom·typing·countUp)
 * - loop: 시작 후 페이지가 끝날 때까지 반복 (blink·bounce)
 */
export type AnimationEffect = 'fade' | 'slide' | 'zoom' | 'typing' | 'countUp' | 'blink' | 'bounce';

export interface ElementAnimation {
  effect: AnimationEffect;
  /** 페이지 재생 시작 후 몇 초 뒤에 움직이기 시작하는지 */
  delay: number;
  /** enter: 나타나는 데 걸리는 시간, loop: 한 번 반복하는 시간 (초) */
  duration: number;
}
